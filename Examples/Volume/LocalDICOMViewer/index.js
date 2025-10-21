import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import Manipulators from '@kitware/vtk.js/Interaction/Manipulators';

// Load the itk-wasm UMD module dynamically for the example.
// Normally, this will just go in the HTML <head>.
import vtkResourceLoader from '@kitware/vtk.js/IO/Core/ResourceLoader';

// vtk imports
import vtkCollection from '@kitware/vtk.js/Common/DataModel/Collection';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkITKHelper from '@kitware/vtk.js/Common/DataModel/ITKHelper';
import vtkImageArrayMapper from '@kitware/vtk.js/Rendering/Core/ImageArrayMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import vtkInteractorStyleManipulator from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkMath from '@kitware/vtk.js/Common/Core/Math';

// ----------------------------------------------------------------------------
// Setup UI
// ----------------------------------------------------------------------------
const rootBody = document.querySelector('body');
rootBody.style.margin = '0';
rootBody.style.padding = '0';
rootBody.style.background = 'rgba(65, 86, 122, 1)';

// Create file input UI
const controlContainer = document.createElement('div');
controlContainer.style.position = 'absolute';
controlContainer.style.top = '10px';
controlContainer.style.left = '10px';
controlContainer.style.zIndex = '1000';
controlContainer.style.background = 'rgba(255, 255, 255, 0.9)';
controlContainer.style.padding = '15px';
controlContainer.style.borderRadius = '5px';
controlContainer.style.fontFamily = 'Arial, sans-serif';

const title = document.createElement('h3');
title.innerText = 'Local DICOM Viewer';
title.style.margin = '0 0 10px 0';
controlContainer.appendChild(title);

const instructions = document.createElement('p');
instructions.innerText =
  'Select one or more DICOM files from your local directory:';
instructions.style.margin = '0 0 10px 0';
instructions.style.fontSize = '14px';
controlContainer.appendChild(instructions);

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.multiple = true;
fileInput.accept = '.dcm,.dicom';
fileInput.style.marginBottom = '10px';
controlContainer.appendChild(fileInput);

const statusLabel = document.createElement('div');
statusLabel.style.fontSize = '12px';
statusLabel.style.color = '#333';
statusLabel.style.marginTop = '10px';
controlContainer.appendChild(statusLabel);

rootBody.appendChild(controlContainer);

// ----------------------------------------------------------------------------
// Standard rendering setup for image slice
// ----------------------------------------------------------------------------
const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
  background: [65 / 255, 86 / 255, 122 / 255],
  rootContainer: rootBody,
  containerStyle: { height: '100%', width: '100%', position: 'absolute' },
});
const renderer = fullScreenRenderer.getRenderer();
renderer.getActiveCamera().setParallelProjection(true);
const renderWindow = fullScreenRenderer.getRenderWindow();
const imageActor = vtkImageSlice.newInstance();
const imageMapper = vtkImageArrayMapper.newInstance();
imageActor.setMapper(imageMapper);
renderer.addActor(imageActor);

const istyle = vtkInteractorStyleManipulator.newInstance();
const interactor = renderWindow.getInteractor();
interactor.setInteractorStyle(istyle);

const collection = vtkCollection.newInstance();

// ----------------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------------
function updateWindowLevel(slice) {
  try {
    const img = imageMapper.getImage(slice);
    if (!img) {
      console.warn(`No image at slice ${slice}`);
      return;
    }

    const scalars = img.getPointData().getScalars();
    if (!scalars) {
      console.warn('No scalars found in image');
      return;
    }

    const range = scalars.getRange();
    const maxWidth = range[1] - range[0];
    imageActor.getProperty().setColorWindow(maxWidth);
    const center = Math.round((range[0] + range[1]) / 2);
    imageActor.getProperty().setColorLevel(center);
  } catch (error) {
    console.error('Error updating window level:', error);
  }
}

function setupVisualization() {
  // Check if collection has items
  if (collection.getNumberOfItems() === 0) {
    console.error('Collection is empty');
    statusLabel.innerText = 'Error: No images in collection.';
    return;
  }

  console.log(
    `Setting up visualization with ${collection.getNumberOfItems()} image(s)`
  );

  // Slice representation
  imageMapper.setInputData(collection);

  // Wait for mapper to be ready
  imageMapper.modified();

  // Initial windowing - wait a tick for the mapper to process
  setTimeout(() => {
    updateWindowLevel(0);
  }, 10);

  // Clear existing manipulators
  istyle.removeAllMouseManipulators();

  // Add manipulators
  const mousePanning =
    Manipulators.vtkMouseCameraTrackballPanManipulator.newInstance({
      button: 1,
    });
  istyle.addMouseManipulator(mousePanning);

  const mouseZooming =
    Manipulators.vtkMouseCameraTrackballZoomManipulator.newInstance({
      button: 3,
    });
  istyle.addMouseManipulator(mouseZooming);

  const mouseSlicing = Manipulators.vtkMouseRangeManipulator.newInstance({
    scrollEnabled: true,
  });
  istyle.addMouseManipulator(mouseSlicing);

  // Setup camera
  const firstImage = collection.getItem(0);
  if (!firstImage) {
    console.error('No image in collection');
    statusLabel.innerText = 'Error: No valid images loaded.';
    return;
  }

  try {
    const d9 = firstImage.getDirection();
    const normal = [0, 0, 1];
    const viewUp = [0, -1, 0];
    vtkMath.multiply3x3_vect3(d9, normal, normal);
    vtkMath.multiply3x3_vect3(d9, viewUp, viewUp);
    const camera = renderer.getActiveCamera();
    const focalPoint = firstImage.getCenter();
    const position = focalPoint.map((e, i) => e - normal[i]); // offset along the slicing axis
    camera.setPosition(...position);
    camera.setFocalPoint(...focalPoint);
    camera.setViewUp(viewUp);
    renderer.resetCamera(); // adjust position along normal + zoom (parallel scale)

    // Initial slice
    const minSlice = 0;
    const maxSlice = Math.max(0, imageMapper.getTotalSlices() - 1);
    console.log(`Slices range: ${minSlice} to ${maxSlice}`);
    const sliceStep = 1;
    imageMapper.setSlice(0);

    // Slicing bounds for manipulator
    if (maxSlice > 0) {
      mouseSlicing.setScrollListener(
        minSlice,
        maxSlice,
        sliceStep,
        () => imageMapper.getSlice(),
        (val) => {
          console.log('Setting slice: ', val);
          imageMapper.setSlice(val);
          updateWindowLevel(val);
          renderWindow.render();
        }
      );
      statusLabel.innerText = `Loaded ${
        maxSlice + 1
      } image(s). Use mouse wheel to scroll through slices.`;
    } else {
      statusLabel.innerText =
        'Loaded 1 image. Use left-click to pan, right-click to zoom.';
    }

    // Render
    renderWindow.render();
  } catch (error) {
    console.error('Error setting up visualization:', error);
    statusLabel.innerText = `Error: ${error.message}`;
  }
}

// ----------------------------------------------------------------------------
// File loading handler
// ----------------------------------------------------------------------------
async function loadDICOMFiles(files) {
  if (!files || files.length === 0) {
    statusLabel.innerText = 'No files selected.';
    return;
  }

  statusLabel.innerText = `Loading ${files.length} file(s)...`;
  console.log(`Loading ${files.length} DICOM file(s)`);

  // Clear previous data
  collection.removeAllItems();

  try {
    const imageArray = [];

    // Read all files
    await Promise.all(
      Array.from(files).map(async (file, index) => {
        const arrayBuffer = await file.arrayBuffer();

        // Use itk-wasm to read the DICOM file
        const { image: itkImage, webWorker } =
          await window.itk.readImageArrayBuffer(null, arrayBuffer, file.name);
        webWorker.terminate();

        // Convert to VTK image
        const vtkImage = vtkITKHelper.convertItkToVtkImage(itkImage);
        imageArray[index] = vtkImage;

        console.log(`Loaded file ${index + 1}/${files.length}: ${file.name}`);
        console.log('VTK Image dimensions:', vtkImage.getDimensions());
        console.log('VTK Image spacing:', vtkImage.getSpacing());
      })
    );

    // Add images to collection
    if (imageArray.length > 0) {
      imageArray.forEach((img, idx) => {
        if (img) {
          collection.addItem(img);
          console.log(`Added image ${idx} to collection`);
        } else {
          console.warn(`Image ${idx} is null or undefined`);
        }
      });

      console.log(`Collection now has ${collection.getNumberOfItems()} items`);
      setupVisualization();
    } else {
      statusLabel.innerText = 'Failed to load images.';
    }
  } catch (error) {
    console.error('Error loading DICOM files:', error);
    statusLabel.innerText = `Error: ${error.message}`;
  }
}

// ----------------------------------------------------------------------------
// Event listeners
// ----------------------------------------------------------------------------
fileInput.addEventListener('change', (event) => {
  const files = event.target.files;
  loadDICOMFiles(files);
});

// After the itk-wasm UMD script has been loaded, `window.itk` provides the itk-wasm API.
vtkResourceLoader
  .loadScript(
    'https://cdn.jsdelivr.net/npm/itk-wasm@1.0.0-b.8/dist/umd/itk-wasm.js'
  )
  .then(() => {
    statusLabel.innerText = 'Ready. Please select DICOM file(s).';
    console.log('itk-wasm loaded successfully');
  })
  .catch((error) => {
    statusLabel.innerText = 'Error loading itk-wasm library.';
    console.error('Error loading itk-wasm:', error);
  });

// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------
global.imageMapper = imageMapper;
global.imageActor = imageActor;
global.renderer = renderer;
global.renderWindow = renderWindow;
global.collection = collection;
