
// Surface3D.ts - Complete implementation with colorbar and fixed rotation
import * as p from "core/properties"
import {LayoutDOM, LayoutDOMView} from "models/layouts/layout_dom"
import {div} from "core/dom"
import {getPalette, valueToColor, getValueRange} from "./palettes"

export class Surface3DView extends LayoutDOMView {
  declare model: Surface3D
  private container_el?: HTMLDivElement
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  private colorbar_canvas?: HTMLCanvasElement
  private colorbar_ctx?: CanvasRenderingContext2D
  private tooltip_el?: HTMLDivElement
  private mouse_x: number = 0
  private mouse_y: number = 0
  private is_dragging: boolean = false
  private drag_start_x: number = 0
  private drag_start_y: number = 0
  private drag_start_azimuth: number = 0
  private drag_start_elevation: number = 0
  private animation_id?: number
  private rotation_resume_timeout?: number

  override get child_models(): LayoutDOM[] {
    return []
  }

  override connect_signals(): void {
    super.connect_signals()
    this.connect(this.model.properties.azimuth.change, () => this.render_surface())
    this.connect(this.model.properties.elevation.change, () => this.render_surface())
    this.connect(this.model.properties.zoom.change, () => this.render_surface())
    this.connect(this.model.properties.palette.change, () => {
      this.render_surface()
      this.render_colorbar()
    })
    this.connect(this.model.properties.vmin.change, () => this.render_colorbar())
    this.connect(this.model.properties.vmax.change, () => this.render_colorbar())
    this.connect(this.model.properties.background_color.change, () => {
      if (this.container_el) {
        this.container_el.style.background = this.model.background_color
      }
      this.render_surface()
      this.render_colorbar()
    })
    this.connect(this.model.properties.colorbar_text_color.change, () => this.render_colorbar())
    this.connect(this.model.properties.show_colorbar.change, () => {
      if (this.colorbar_canvas) {
        this.colorbar_canvas.style.display = this.model.show_colorbar ? 'block' : 'none'
      }
    })
    this.connect(this.model.properties.autorotate.change, () => {
      if (this.model.autorotate) {
        this.start_autorotation()
      } else {
        this.stop_autorotation()
      }
    })
  }

  override render(): void {
    super.render()
    const width = this.model.width ?? 800
    const height = this.model.height ?? 800
    
    this.container_el = div({style: {
      width: `${width + 140}px`,
      height: `${height}px`,
      background: this.model.background_color,
      position: 'relative',
      display: 'flex',
      cursor: 'grab'
    }})
    
    // Main canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.container_el.appendChild(this.canvas)
    
    // Colorbar canvas
    if (this.model.show_colorbar) {
      this.colorbar_canvas = document.createElement('canvas')
      this.colorbar_canvas.width = 150
      this.colorbar_canvas.height = height
      this.colorbar_canvas.style.marginLeft = '10px'
      this.container_el.appendChild(this.colorbar_canvas)
      this.colorbar_ctx = this.colorbar_canvas.getContext('2d')!
    }
    
    // Tooltip
    this.tooltip_el = div({style: {
      position: 'absolute', background: 'rgba(0, 0, 0, 0.85)', color: 'white',
      padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
      fontFamily: 'monospace', pointerEvents: 'none', display: 'none',
      zIndex: '1000', border: '1px solid rgba(255, 255, 255, 0.3)', whiteSpace: 'nowrap'
    }})
    this.container_el.appendChild(this.tooltip_el)
    
    this.setup_interactions()
    this.shadow_el.appendChild(this.container_el)
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    this.render_surface()
    this.render_colorbar()
    
    if (this.model.autorotate) {
      this.start_autorotation()
    }
  }

  private render_colorbar(): void {
    if (!this.colorbar_ctx || !this.colorbar_canvas || !this.model.show_colorbar) return
    
    const ctx = this.colorbar_ctx
    const canvas = this.colorbar_canvas
    const width = canvas.width
    const height = canvas.height
    
    // Clear with background color
    ctx.fillStyle = this.model.background_color
    ctx.fillRect(0, 0, width, height)
    
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(this.model.values, this.model.vmin, this.model.vmax)
    
    // Colorbar dimensions
    const bar_width = 30
    const bar_height = height * 0.7
    const bar_x = 35
    const bar_y = (height - bar_height) / 2
    
    // Draw color gradient
    const step = bar_height / palette.length
    for (let i = 0; i < palette.length; i++) {
      ctx.fillStyle = palette[palette.length - 1 - i]
      ctx.fillRect(bar_x, bar_y + i * step, bar_width, step + 1)
    }
    
    // Draw border with text color
    ctx.strokeStyle = this.model.colorbar_text_color
    ctx.lineWidth = 1
    ctx.strokeRect(bar_x, bar_y, bar_width, bar_height)
    
    // Draw ticks and labels with text color
    ctx.fillStyle = this.model.colorbar_text_color
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    
    const n_ticks = 5
    for (let i = 0; i < n_ticks; i++) {
      const frac = i / (n_ticks - 1)
      const value = vmin + (vmax - vmin) * (1 - frac)
      const y = bar_y + frac * bar_height
      
      // Tick mark
      ctx.beginPath()
      ctx.moveTo(bar_x + bar_width, y)
      ctx.lineTo(bar_x + bar_width + 5, y)
      ctx.stroke()
      
      // Label
      const label = value.toFixed(1)
      ctx.fillText(label, bar_x + bar_width + 10, y + 4)
    }
    
    // Title with text color
    if (this.model.colorbar_title) {
      ctx.save()
      ctx.translate(12, height / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.font = 'bold 13px monospace'
      ctx.fillStyle = this.model.colorbar_text_color
      ctx.fillText(this.model.colorbar_title, 0, 0)
      ctx.restore()
    }
  }

  private setup_interactions(): void {
    if (!this.canvas) return
    
    this.canvas.onmousedown = (e) => {
      this.is_dragging = true
      this.drag_start_x = e.clientX
      this.drag_start_y = e.clientY
      this.drag_start_azimuth = this.model.azimuth
      this.drag_start_elevation = this.model.elevation
      this.container_el!.style.cursor = 'grabbing'
      this.stop_autorotation()
      if (this.rotation_resume_timeout) clearTimeout(this.rotation_resume_timeout)
    }
    
    this.canvas.onmousemove = (e) => {
      const rect = this.canvas!.getBoundingClientRect()
      this.mouse_x = e.clientX - rect.left
      this.mouse_y = e.clientY - rect.top
      
      if (this.is_dragging) {
        const dx = e.clientX - this.drag_start_x
        const dy = e.clientY - this.drag_start_y
        const new_azimuth = this.drag_start_azimuth - dx * 0.5
        this.model.azimuth = ((new_azimuth % 360) + 360) % 360
        const new_elevation = this.drag_start_elevation - dy * 0.5
        this.model.elevation = Math.max(-90, Math.min(90, new_elevation))
      } else if (this.model.enable_hover) {
        this.update_tooltip()
      }
    }
    
    this.canvas.onmouseup = () => {
      this.is_dragging = false
      this.container_el!.style.cursor = 'grab'
      if (this.model.autorotate) {
        if (this.rotation_resume_timeout) clearTimeout(this.rotation_resume_timeout)
        this.rotation_resume_timeout = window.setTimeout(() => {
          this.start_autorotation()
        }, 1000)
      }
    }
    
    this.canvas.onmouseleave = () => {
      this.is_dragging = false
      this.container_el!.style.cursor = 'grab'
      if (this.tooltip_el) this.tooltip_el.style.display = 'none'
    }
    
    this.canvas.onwheel = (e) => {
      e.preventDefault()
      const delta = -Math.sign(e.deltaY) * 0.1
      const new_zoom = this.model.zoom + delta
      this.model.zoom = Math.max(0.5, Math.min(8.0, new_zoom))
    }
  }

  private render_surface(): void {
    if (!this.ctx) return
    const ctx = this.ctx
    const width = this.model.width ?? 800
    const height = this.model.height ?? 800
    
    ctx.fillStyle = this.model.background_color
    ctx.fillRect(0, 0, width, height)
    
    const elev_rad = this.model.elevation * Math.PI / 180
    const azim_rad = this.model.azimuth * Math.PI / 180
    const zoom = this.model.zoom
    const lons = this.model.lons
    const lats = this.model.lats
    const values = this.model.values
    
    // Project 3D surface
    const projected = []
    for (let i = 0; i < lons.length; i++) {
      const x = -lons[i]
      const y = lats[i]
      const z = values[i]
      
      const x_rot = x * Math.cos(azim_rad) - y * Math.sin(azim_rad)
      const y_rot = x * Math.sin(azim_rad) + y * Math.cos(azim_rad)
      const x_proj = x_rot
      const z_proj = y_rot * Math.sin(elev_rad) + z * Math.cos(elev_rad)
      const depth = y_rot * Math.cos(elev_rad) - z * Math.sin(elev_rad)
      
      projected.push({ x: x_proj, y: z_proj, depth: depth })
    }
    
    // FIXED: Calculate bounds from original data, not projected data
    // This ensures consistent scaling regardless of rotation angle
    const data_x_min = -Math.min(...lons)
    const data_x_max = -Math.max(...lons)
    const data_y_min = Math.min(...lats)
    const data_y_max = Math.max(...lats)
    const data_z_min = Math.min(...values)
    const data_z_max = Math.max(...values)
    
    // Use the maximum extent in any dimension for consistent scaling
    const data_range = Math.max(
      data_x_max - data_x_min,
      data_y_max - data_y_min,
      data_z_max - data_z_min
    )
    
    // Fixed scale based on data range, not projection
    const scale = (Math.min(width, height) / data_range) * 0.6 * zoom
    const cx = width / 2
    const cy = height / 2
    
    // Center the data
    const data_center_x = (data_x_min + data_x_max) / 2
    const data_center_y = (data_y_min + data_y_max) / 2
    
    // Scale and center - project center point to find offset
    const center_x_rot = data_center_x * Math.cos(azim_rad) - data_center_y * Math.sin(azim_rad)
    const center_y_rot = data_center_x * Math.sin(azim_rad) + data_center_y * Math.cos(azim_rad)
    const center_z = (data_z_min + data_z_max) / 2
    const center_x_proj = center_x_rot
    const center_z_proj = center_y_rot * Math.sin(elev_rad) + center_z * Math.cos(elev_rad)
    
    const screen_projected = []
    for (const p of projected) {
      screen_projected.push({
        x: cx + (p.x - center_x_proj) * scale,
        y: cy - (p.y - center_z_proj) * scale,
        depth: p.depth
      })
    }
    
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(values, this.model.vmin, this.model.vmax)
    const n_lat = this.model.n_lat
    const n_lon = this.model.n_lon
    
    // Create and sort quads by depth
    const quads = []
    for (let i = 0; i < n_lat - 1; i++) {
      for (let j = 0; j < n_lon - 1; j++) {
        const idx0 = i * n_lon + j
        const idx1 = i * n_lon + (j + 1)
        const idx2 = (i + 1) * n_lon + (j + 1)
        const idx3 = (i + 1) * n_lon + j
        
        const p0 = screen_projected[idx0]
        const p1 = screen_projected[idx1]
        const p2 = screen_projected[idx2]
        const p3 = screen_projected[idx3]
        
        const avg_value = (values[idx0] + values[idx1] + values[idx2] + values[idx3]) / 4
        const avg_depth = (p0.depth + p1.depth + p2.depth + p3.depth) / 4
        const color = valueToColor(avg_value, palette, vmin, vmax, this.model.nan_color)
        
        quads.push({
          depth: avg_depth,
          points: [p0, p1, p2, p3],
          color: color
        })
      }
    }
    
    quads.sort((a, b) => a.depth - b.depth)
    
    for (const quad of quads) {
      ctx.fillStyle = quad.color
      ctx.strokeStyle = quad.color
      ctx.lineWidth = 1.2
      ctx.globalAlpha = 1
      
      ctx.beginPath()
      ctx.moveTo(quad.points[0].x, quad.points[0].y)
      ctx.lineTo(quad.points[1].x, quad.points[1].y)
      ctx.lineTo(quad.points[2].x, quad.points[2].y)
      ctx.lineTo(quad.points[3].x, quad.points[3].y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.globalAlpha = 1.0
    }
  }

  private update_tooltip(): void {
    if (!this.tooltip_el || !this.canvas || !this.ctx) return
    const imageData = this.ctx.getImageData(this.mouse_x, this.mouse_y, 1, 1)
    const pixel = imageData.data
    
    if (pixel[0] > 10 || pixel[1] > 10 || pixel[2] > 10) {
      const palette = getPalette(this.model.palette)
      const {vmin, vmax} = getValueRange(this.model.values, this.model.vmin, this.model.vmax)
      let closest_idx = 0
      let min_distance = Infinity
      
      for (let i = 0; i < palette.length; i++) {
        const pal_r = parseInt(palette[i].slice(1, 3), 16)
        const pal_g = parseInt(palette[i].slice(3, 5), 16)
        const pal_b = parseInt(palette[i].slice(5, 7), 16)
        const distance = Math.abs(pal_r - pixel[0]) + Math.abs(pal_g - pixel[1]) + Math.abs(pal_b - pixel[2])
        if (distance < min_distance) {
          min_distance = distance
          closest_idx = i
        }
      }
      
      const value = vmin + (closest_idx / (palette.length - 1)) * (vmax - vmin)
      this.tooltip_el.innerHTML = `Value: ${value.toFixed(2)}`
      this.tooltip_el.style.display = 'block'
      this.tooltip_el.style.left = `${this.mouse_x + 15}px`
      this.tooltip_el.style.top = `${this.mouse_y - 30}px`
    } else {
      this.tooltip_el.style.display = 'none'
    }
  }

  private start_autorotation(): void {
    if (this.animation_id !== undefined) return
    const animate = () => {
      if (!this.model.autorotate || this.is_dragging) return
      this.model.azimuth = (this.model.azimuth + this.model.rotation_speed * 0.5) % 360
      this.animation_id = requestAnimationFrame(animate)
    }
    animate()
  }

  private stop_autorotation(): void {
    if (this.animation_id !== undefined) {
      cancelAnimationFrame(this.animation_id)
      this.animation_id = undefined
    }
  }

  override remove(): void {
    this.stop_autorotation()
    if (this.rotation_resume_timeout) clearTimeout(this.rotation_resume_timeout)
    super.remove()
  }
}

export namespace Surface3D {
  export type Attrs = p.AttrsOf<Props>
  export type Props = LayoutDOM.Props & {
    lons: p.Property<number[]>
    lats: p.Property<number[]>
    values: p.Property<number[]>
    n_lat: p.Property<number>
    n_lon: p.Property<number>
    palette: p.Property<string>
    vmin: p.Property<number>
    vmax: p.Property<number>
    nan_color: p.Property<string>
    azimuth: p.Property<number>
    elevation: p.Property<number>
    zoom: p.Property<number>
    autorotate: p.Property<boolean>
    rotation_speed: p.Property<number>
    enable_hover: p.Property<boolean>
    show_colorbar: p.Property<boolean>
    colorbar_title: p.Property<string>
    background_color: p.Property<string>
    colorbar_text_color: p.Property<string>
  }
}

export interface Surface3D extends Surface3D.Attrs {}

export class Surface3D extends LayoutDOM {
  declare properties: Surface3D.Props
  declare __view_type__: Surface3DView

  constructor(attrs?: Partial<Surface3D.Attrs>) {
    super(attrs)
  }

  static {
    this.prototype.default_view = Surface3DView
    this.define<Surface3D.Props>(({Bool, Float, Int, List, String}) => ({
      lons: [ List(Float), [] ],
      lats: [ List(Float), [] ],
      values: [ List(Float), [] ],
      n_lat: [ Int, 30 ],
      n_lon: [ Int, 60 ],
      palette: [ String, 'Turbo256' ],
      vmin: [ Float, NaN ],
      vmax: [ Float, NaN ],
      nan_color: [ String, '#808080' ],
      azimuth: [ Float, 45 ],
      elevation: [ Float, -30 ],
      zoom: [ Float, 1.0 ],
      autorotate: [ Bool, false ],
      rotation_speed: [ Float, 1.0 ],
      enable_hover: [ Bool, true ],
      show_colorbar: [ Bool, true ],
      colorbar_title: [ String, 'Value' ],
      background_color: [ String, '#0a0a0a' ],
      colorbar_text_color: [ String, '#ffffff' ],
    }))
  }
}