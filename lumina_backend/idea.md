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