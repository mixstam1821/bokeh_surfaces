

import numpy as np
from surface3d_py import Surface3D
from bokeh.models import TextInput, Select, Button, Div, CustomJS
from bokeh.layouts import column, row
from bokeh.plotting import output_file, save, show

# Global parameters
n_points = 50
x_range = (-3, 3)
y_range = (-3, 3)

# Preset equations
PRESETS = [
    "Custom",
    "np.sin(X*2) * np.cos(Y*2)",
    "np.sin(3*np.sqrt(X**2 + Y**2))/(np.sqrt(X**2 + Y**2) + 0.000001)",
    "(1 - (X**2 + Y**2)) * np.exp(-(X**2 + Y**2)/2)",
    "np.sin(X)*np.cos(Y)",
    "np.sin(np.sqrt(X**2 + Y**2))",
    "np.exp(-0.1*(X**2+Y**2))*np.sin(X*2)*np.cos(Y*2)",
    "np.tanh(X)*np.tanh(Y)",
    "np.sin(X)*np.sin(Y) + np.cos(X*Y)",
    "X**2 - Y**2",
    "np.sin(X)*np.exp(-(Y**2))",
    "np.cos(X**2 + Y**2)",
    "X**3 - 3*X*Y**2",
]

PALETTES = ["gist_earth", "YlOrBr", "cool", "terrain", "RdYlGn", "cividis", "Spectral","afmhot","bwr"]

def compute_surface(equation_str):
    """Compute surface from equation string"""
    try:
        x = np.linspace(x_range[0], x_range[1], n_points)
        y = np.linspace(y_range[0], y_range[1], n_points)
        X, Y = np.meshgrid(x, y)
        
        namespace = {'np': np, 'X': X, 'Y': Y}
        Z = eval(equation_str, {"__builtins__": {}}, namespace)
        
        return X.flatten(), Y.flatten(), Z.flatten(), None
    except Exception as e:
        return None, None, None, str(e)

# Initial surface
initial_equation = "np.sin(X*2) * np.cos(Y*2)"
X, Y, Z, error = compute_surface(initial_equation)

if error:
    print(f"Error: {error}")
    x = np.linspace(-3, 3, n_points)
    y = np.linspace(-3, 3, n_points)
    X, Y = np.meshgrid(x, y)
    Z = X * 0
    X, Y, Z = X.flatten(), Y.flatten(), Z.flatten()

# Create Surface3D
surface = Surface3D(
    lons=X.tolist(),
    lats=Y.tolist(),
    values=Z.tolist(),
    n_lat=n_points,
    n_lon=n_points,
    palette='terrain',
    autorotate=False,
    zoom=1.2,
    width=900,
    height=700,
    background_color='#f5f5f5',
    colorbar_text_color='#333333',
    show_colorbar=True,
    elevation=-25,
    azimuth=45,
)

# UI Controls
title_div = Div(text="""
    <div style='text-align:center; padding:20px; 
                background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                border-radius:8px; margin-bottom:20px; color:white;'>
        <h1 style='margin:0; font-size:2.5em;'>🎨 Interactive 3D Surface Plotter</h1>
        <p style='margin:5px 0 0 0; font-size:1.2em;'>
            Powered by Surface3D - Click and Drag to Rotate!
        </p>
    </div>
""", width=380)

instructions_div = Div(text="""
    <div style='padding:15px; background:#f0f8ff; border-left:4px solid #667eea; 
                margin-bottom:15px; border-radius:5px;'>
        <b>📝 Instructions:</b><br>
        • Use NumPy functions: np.sin(), np.cos(), np.exp(), np.sqrt(), np.tanh(), etc.<br>
        • Variables are <b>X</b> and <b>Y</b> (capital letters)<br>
        • Examples: np.sin(X*2) * np.cos(Y*2), X**2 - Y**2, np.exp(-X**2-Y**2)<br>
        • <b>Click "Update Surface"</b> to compute new equation<br>
        • <b>Click and drag</b> the surface to rotate interactively!<br>
        • <b>Mouse wheel</b> to zoom in/out
    </div>
""", width=380)

equation_input = TextInput(
    value=initial_equation,
    title="Equation (use X, Y, np.sin, np.cos, np.exp, etc.):",
    width=280
)

preset_select = Select(
    title="Presets:",
    value="Custom",
    width=280,
    options=PRESETS
)

palette_select = Select(
    title="Color Palette:",
    value="terrain",
    width=280,
    options=PALETTES
)

update_button = Button(
    label="Update Surface",
    button_type="success",
    width=280
)

status_div = Div(
    text="<div style='padding:10px; background:#e8f5e9; border-radius:5px;'>"
         "<b>✓ Status:</b> Ready - Enter an equation and click Update!</div>",
    width=280
)

# CustomJS callback to update surface
# This updates Surface3D's lons, lats, values properties directly
update_callback = CustomJS(
    args=dict(
        equation_input=equation_input,
        palette_select=palette_select,
        status_div=status_div,
        surface=surface,
        n_points=n_points,
        x_min=x_range[0],
        x_max=x_range[1],
        y_min=y_range[0],
        y_max=y_range[1]
    ),
    code="""
    status_div.text = "<div style='padding:10px; background:#fff3cd; border-radius:5px;'><b>⏳ Status:</b> Computing surface...</div>";

    try {
        const equation = equation_input.value;
        const n = n_points;

        // Create grid and compute surface
        const lons = [];
        const lats = [];
        const values = [];
        
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const X = x_min + (x_max - x_min) * i / (n - 1);
                const Y = y_min + (y_max - y_min) * j / (n - 1);
                
                // Create safe numpy-like object
                const np = {
                    sin: Math.sin,
                    cos: Math.cos,
                    tan: Math.tan,
                    exp: Math.exp,
                    log: Math.log,
                    sqrt: Math.sqrt,
                    abs: Math.abs,
                    tanh: Math.tanh,
                    sinh: Math.sinh,
                    cosh: Math.cosh,
                    PI: Math.PI,
                    E: Math.E
                };
                
                // Evaluate equation
                let safe_eq = equation
                    .replace(/X/g, `(${X})`)
                    .replace(/Y/g, `(${Y})`)
                    .replace(/np\./g, 'np.');
                
                const Z = eval(safe_eq);
                
                lons.push(X);
                lats.push(Y);
                values.push(Z);
            }
        }
        
        // Update Surface3D properties directly
        surface.lons = lons;
        surface.lats = lats;
        surface.values = values;
        
        // Update palette if changed
        surface.palette = palette_select.value;
        
        // HACK: Trigger surface re-render by tiny rotation change
        surface.azimuth = surface.azimuth + 0.0000001;
        
        status_div.text = "<div style='padding:10px; background:#e8f5e9; border-radius:5px;'><b>✓ Status:</b> Surface updated! Click and drag to rotate.</div>";
        
    } catch (e) {
        status_div.text = "<div style='padding:10px; background:#f8d7da; border-radius:5px;'><b>❌ Error:</b> " + e.message + "</div>";
    }
    """
)

# Preset selection callback - auto-updates surface
preset_callback = CustomJS(
    args=dict(
        preset_select=preset_select,
        equation_input=equation_input,
        palette_select=palette_select,
        status_div=status_div,
        surface=surface,
        n_points=n_points,
        x_min=x_range[0],
        x_max=x_range[1],
        y_min=y_range[0],
        y_max=y_range[1]
    ),
    code="""
    if (preset_select.value !== 'Custom') {
        equation_input.value = preset_select.value;
        
        // Auto-update the surface
        status_div.text = "<div style='padding:10px; background:#fff3cd; border-radius:5px;'><b>⏳ Status:</b> Computing surface...</div>";

        try {
            const equation = equation_input.value;
            const n = n_points;

            // Create grid and compute surface
            const lons = [];
            const lats = [];
            const values = [];
            
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    const X = x_min + (x_max - x_min) * i / (n - 1);
                    const Y = y_min + (y_max - y_min) * j / (n - 1);
                    
                    // Create safe numpy-like object
                    const np = {
                        sin: Math.sin,
                        cos: Math.cos,
                        tan: Math.tan,
                        exp: Math.exp,
                        log: Math.log,
                        sqrt: Math.sqrt,
                        abs: Math.abs,
                        tanh: Math.tanh,
                        sinh: Math.sinh,
                        cosh: Math.cosh,
                        PI: Math.PI,
                        E: Math.E
                    };
                    
                    // Evaluate equation
                    let safe_eq = equation
                        .replace(/X/g, `(${X})`)
                        .replace(/Y/g, `(${Y})`)
                        .replace(/np\./g, 'np.');
                    
                    const Z = eval(safe_eq);
                    
                    lons.push(X);
                    lats.push(Y);
                    values.push(Z);
                }
            }
            
            // Update Surface3D properties directly
            surface.lons = lons;
            surface.lats = lats;
            surface.values = values;
            
            // HACK: Trigger surface re-render by tiny rotation change
            surface.azimuth = surface.azimuth + 0.0000001;
            
            status_div.text = "<div style='padding:10px; background:#e8f5e9; border-radius:5px;'><b>✓ Status:</b> Surface updated! Click and drag to rotate.</div>";
            
        } catch (e) {
            status_div.text = "<div style='padding:10px; background:#f8d7da; border-radius:5px;'><b>❌ Error:</b> " + e.message + "</div>";
        }
    }
    """
)

# Palette change callback
palette_callback = CustomJS(
    args=dict(
        palette_select=palette_select,
        surface=surface
    ),
    code="""
    surface.palette = palette_select.value;
    """
)

# Connect callbacks
update_button.js_on_click(update_callback)
preset_select.js_on_change('value', preset_callback)
palette_select.js_on_change('value', palette_callback)

# Layout
controls = column(
    title_div,
    instructions_div,
    preset_select,
    equation_input,
    palette_select, update_button,
    status_div
)

layout = column(
    row(controls,
    surface)
)

# Save to HTML
output_file("surface_explorer.html")
save(layout)
show(layout)
