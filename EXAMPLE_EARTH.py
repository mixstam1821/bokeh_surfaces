from surface3d_py import Surface3D
from bokeh.plotting import show, output_file
import numpy as np
import xarray as xr
import numpy as np

# Load and coarsen
ds = xr.open_dataset("elev.nc")
ds_coarse = ds.coarsen(latitude=5, longitude=5, boundary='trim').mean()

# Choose the variable (check ds_coarse)
elev = ds_coarse["elevation"]

# Flip latitude if needed
# elev = elev.isel(latitude=slice(None, None, -1))
# elev = elev.isel(longitude=slice(None, None, -1))

# Get coarsened dimensions
n_lat, n_lon = elev.shape

lons = elev.longitude.values
lats = elev.latitude.values
Zraw = elev.values

# Normalize
Znorm = (Zraw - np.nanmean(Zraw)) / np.nanstd(Zraw)
Znorm = 80 * (Zraw - np.nanmin(Zraw)) / (np.nanmax(Zraw) - np.nanmin(Zraw)) 

# Flatten in row-major order (first lat, then lon)
lons_flat, lats_flat = np.meshgrid(lons, lats)
lons_flat = lons_flat.flatten()
lats_flat = lats_flat.flatten()
values_flat = Znorm.flatten()

print(f"n_lat={n_lat}, n_lon={n_lon}, len(values_flat)={len(values_flat)}")



surface = Surface3D(
    lons=lons_flat.tolist(),
    lats=lats_flat.tolist(),
    values=values_flat.tolist(),
    n_lat=n_lat,
    n_lon=n_lon,
    width=800,
    height=800,
    palette='terrain',
    azimuth=45,
    elevation=-30,
    zoom=1.0,
    autorotate=False,
    rotation_speed=1.0,
    enable_hover=True,
    show_colorbar=True,
    colorbar_title='Elevation',
    background_color='#0a0a0a',
    colorbar_text_color='#ffffff'
)

show(surface)