
from bokeh.core.properties import Int, Float, String, List, Bool
from bokeh.models import LayoutDOM

class Surface3D(LayoutDOM):
    """
    A 3D surface visualization component with interactive rotation, colorbar, and tooltips.
    
    This component renders a 3D surface plot from gridded data (lons, lats, values) with
    customizable viewing angles, zoom, palette coloring, and an optional colorbar.
    """
    
    __implementation__ = "surface3d.ts"
    
    # Data properties
    lons = List(Float, help="X-coordinates (longitude) of the surface grid points")
    lats = List(Float, help="Y-coordinates (latitude) of the surface grid points")
    values = List(Float, help="Z-values at each grid point")
    n_lat = Int(30, help="Number of latitude grid points")
    n_lon = Int(60, help="Number of longitude grid points")
    
    # Color properties
    palette = String("Turbo256", help="Color palette name for value mapping")
    vmin = Float(float('nan'), help="Minimum value for color scaling (auto if NaN)")
    vmax = Float(float('nan'), help="Maximum value for color scaling (auto if NaN)")
    nan_color = String("#808080", help="Color for NaN/missing values")
    
    # View properties
    azimuth = Float(45, help="Horizontal rotation angle in degrees (0-360)")
    elevation = Float(-30, help="Vertical tilt angle in degrees (-90 to 90)")
    zoom = Float(1.0, help="Zoom level (0.5 to 8.0)")
    
    # Animation properties
    autorotate = Bool(False, help="Enable automatic rotation")
    rotation_speed = Float(1.0, help="Speed of auto-rotation")
    
    # Interaction properties
    enable_hover = Bool(True, help="Show tooltips on hover")
    
    # Colorbar properties
    show_colorbar = Bool(True, help="Display the colorbar")
    colorbar_title = String("Value", help="Title text for the colorbar")
    
    # Appearance properties
    background_color = String("#0a0a0a", help="Background color of the visualization")
    colorbar_text_color = String("#ffffff", help="Text color for colorbar labels and title")