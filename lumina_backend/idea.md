This is a comprehensive and robust feature set. You have effectively designed an **end-to-end pipeline**: from data ingestion  preprocessing (tiling)  AI inference  user interaction  mathematical estimation  predictive analytics.

Here is my assessment of the idea, followed by a refined, professional rephrasing of the workflow that you can use for documentation or development planning.

### **Critique & Technical Refinements**

1. **Tiling Strategy (Smart Defaults):**
* *Your Idea:* User selects tiling dimensions via radio buttons.
* *Refinement:* Most users won't know the optimal input size for your ML model. While you should keep the manual override, I suggest adding an **"Auto-Optimize"** default. If your model was trained on  images, the system should recommend tiling to that size automatically to ensure the best inference accuracy.


2. **Naming Convention vs. Database:**
* *Your Idea:* deeply nested folder structures with specific filenames (`<project>_<id>_<tile>.jpg`).
* *Refinement:* While saving files this way is fine for storage, rely on **MongoDB** to track relationships. Do not parse file names to understand the app logic. Store the file path in the DB. This makes the system less brittle if you decide to change naming conventions later.


3. **The "Global vs. Individual" Location:**
* *Your Idea:* Global location for the project, with per-image overrides.
* *Refinement:* This is excellent. Make sure to integrate a Map API (like Mapbox or Google Maps) to let users "pin" the location easily, rather than typing latitude/longitude manually.


4. **Async Processing (Crucial):**
* *Technical Note:* Steps 3 and 4 (Tiling and ML Inference) are computationally heavy. You cannot do this in the standard request/response cycle or the browser will timeout. You must use a **Background Task Queue** (like Celery or ARQ) to handle this processing while showing a progress bar on the Frontend.


5. **Solar Algorithm:**
* *Refinement:* For Step 7 (Panel Estimation), simple division (Rooftop Area / Panel Area) is often inaccurate because panels are rigid rectangles. You should mention using a **"Bin Packing Algorithm"** to fit rectangles into the irregular polygon shapes of roofs.



---

### **Refined Project Workflow Specification**

Here is the rephrased content, organized into logical modules suitable for your System Design Document.

#### **Module 1: Project Initialization & Intelligent Ingestion**

1. **Project Creation:**
The workflow begins with a "Create New Project" modal. The user provides a Project Name and uploads a batch of aerial/satellite images (supports `.jpg`, `.png`, `.tif`).
2. **Adaptive Image Pre-processing:**
Upon selection, the system analyzes image dimensions.
* **Threshold Check:** If an image exceeds  resolution, the system flags it.
* **Tiling Configuration:** The user is prompted with a checkbox: *"Tile large images for better accuracy?"* If checked, the user selects a tile dimension (e.g., , ) via radio buttons.


3. **Structured Storage Pipeline:**
A hierarchical directory structure is generated dynamically:
* `User_Root/`  `Project_Name/`  `Images/` & `Masks/`.
* **Naming Convention:**
* **Standard:** `<project_name>_<unique_id>.<ext>`
* **Tiled:** `<project_name>_<unique_id>_<tile_sequence_id>.<ext>`
* *Note:* Tiled segments are grouped logically within the file system but linked relationally in the MongoDB database.





#### **Module 2: AI Inference Engine**

4. **Automated Segmentation:**
Once stored, images are queued for the Computer Vision pipeline.
* The model generates segmentation masks (polygons) identifying usable rooftop areas.
* Masks are saved in the `Masks/` directory following the same naming convention as their source images.
* Each detected rooftop polygon is assigned a unique UUID in the database for individual tracking.



#### **Module 3: Interactive Visualization Dashboard**

5. **The "Lumina" Workspace:**
Upon project completion, the user enters the main dashboard containing four primary navigation tabs:
* **Uploaded Imagery (Viewer)**
* **Panel Capacity Estimator**
* **Historical Output Analysis**
* **Future Yield Prediction**


6. **Smart Image grouping:**
* Standard images appear individually.
* Tiled images are displayed as a **"Mosaic Collection."** Clicking the collection expands it to show individual tiles.


7. **Active Selection Layer:**
The Viewer renders images with the rooftop masks overlaid.
* **Toggle Functionality:** Users can click specific rooftop polygons to Toggle them **ON (Include)** or **OFF (Exclude)**.
* Excluded polygons turn gray and are ignored in subsequent calculations. This allows users to manually remove obstacles or invalid detections.



#### **Module 4: Solar Simulation & Forecasting**

8. **Capacity Planning (Tab 2):**
* **Inputs:** Users define Solar Panel Dimensions (Length  Width) and Power Rating (Watts). Defaults are provided.
* **Scope:** Option to apply calculation to "All Rooftops" or "Selected Rooftops Only."
* **Logic:** The system runs a placement algorithm to calculate the maximum number of panels that physically fit within the active polygons.


9. **Historical Energy Analysis (Tab 3):**
* **Geolocation:** Users input the geographic coordinates. The system supports a "Project Global" location or specific "Per-Image" coordinates.
* **Data Retrieval:** The system fetches historical irradiance data (GHI/DNI) for that location.
* **Dashboard:** Displays estimated energy generation (kWh) for the past year based on the active rooftop area.


10. **Predictive Analytics (Tab 4):**
* **Forecasting:** Utilizing historical weather patterns and Time-Series Forecasting, the system predicts energy generation for the next **360 days**.
* **Interactivity:** Users can adjust the forecast window (e.g., 30 days, 90 days, 1 year) to visualize short-term vs. long-term potential.














To estimate the electricity generation for the **past 1 year** (historical analysis), you need to move from **Geometric Data** (what you have: area, count) to **Meteorological & Physical Data** (what you need: sun, location, efficiency).

Here is the breakdown of the data required and the insights you can derive.

### **1. The Core Formula**

To calculate Energy () in kWh, the standard formula is:

Where:

*  = Total Solar Panel Area () (You have this)
*  = Solar Panel Yield/Efficiency (%) (Need this)
*  = Annual Solar Radiation on tilted panels () (Need this)
*  = Performance Ratio (System losses) (Need this)

---

### **2. Essential Data You Need**

#### **A. Location Data (Crucial)**

Since the sun shines differently in Chennai vs. London, the system **must** know where the image was taken.

* **Latitude & Longitude:**
* *If utilizing GeoTIFFs:* Extract this from the image metadata.
* *If utilizing PNG/JPG:* You must ask the user to input the location (e.g., "Chennai") or drop a pin on a map.



#### **B. Panel Specifications**

You have dimensions (), but you need the **power density**.

* **Panel Efficiency ():** Typical residential panels are **20% to 22%** efficient.
* **Rated Power ():** Alternatively, if you know a panel is 400W, Total Capacity () = .

#### **C. Historical Meteorological Data (The "Past 1 Year" Part)**

You need historical weather data for that specific Latitude/Longitude.

* **GHI (Global Horizontal Irradiance):** The total amount of shortwave radiation received from above by a surface horizontal to the ground.
* **Temperature:** Solar panels **lose efficiency** as they get hotter. Historical temperature data helps you apply a "temperature coefficient" loss.
* **Sources:**
* **NASA POWER API (Free):** Excellent for historical daily solar data.
* **NREL PVWatts (Free):** Industry standard for estimation.
* **OpenMeteo (Free):** Good historical weather API.



---

### **3. Advanced Parameters for Better Accuracy**

To make your estimation "professional grade," consider these factors:

* **Tilt & Azimuth (Orientation):**
* **Tilt:** Roof slope. (e.g., 20°). If unknown, assume "Latitude Tilt" (optimal) or 0° (flat).
* **Azimuth:** Direction (0° N, 180° S). South-facing panels generate more energy in the Northern Hemisphere.


* **System Losses (Performance Ratio):**
* **Inverter Efficiency:** DC to AC conversion loss (~4%).
* **Soiling:** Dust/dirt on panels (~2-5% in dusty cities).
* **Shading:** You already handled "structural" shading via segmentation, but "time-of-day" shading (e.g., a tree shadow moving across the roof at 4 PM) is a fixed loss factor (~3%).
* *Standard Default:* Use **0.75 (75%)** as a safe Performance Ratio.



---

### **4. Metrics for "Good Insights"**

Once you calculate the kWh generated, you can derive these valuable insights for the user:

#### **A. Environmental Impact**

* ** Offset:** Convert kWh to Carbon avoided.
* *Factor:* ~0.7 kg  per kWh (varies by grid region, e.g., India's grid is coal-heavy, so the impact is higher).


* **Equivalent Trees Planted:** A popular visualization.
* *Factor:* ~1 kWh  0.04 trees planted.


* **Equivalent Coal Burned:** Visualizes the "dirty" energy saved.

#### **B. Financial Viability**

* **Estimated Savings:** Total kWh  Local Electricity Rate (e.g., ₹8/unit or $0.15/kWh).
* **Payback Period:** If you allow the user to input "Installation Cost," you can show how many years until the system pays for itself.

#### **C. Grid Independence**

* **Homes Powered:** "This rooftop can power **3.5 average households**."
* *Factor:* Average household consumption (e.g., 250-300 kWh/month).



---

### **Recommended Implementation Plan**

1. **Frontend Input:** Add a "Location" field (Search box with Google Maps/Mapbox autocomplete) to the `ProjectWorkspace` or `HistoricalAnalysis` tab.
2. **Backend Integration:** Create a service that:
* Takes `lat`, `lon`, `panel_capacity_kw`.
* Calls the **NASA POWER API** (Endpoint: `daily`) for the date range `[Today - 365 days]` to `[Today]`.
* Sum the daily solar irradiance.
* Apply the efficiency formula.


3. **Visualization:** Display a Line Chart showing "Energy Production" month-over-month for the last year (e.g., high in Summer, low in Monsoon/Winter).

Would you like me to provide the **Python code to fetch historical solar data from NASA POWER API** based on lat/lon?