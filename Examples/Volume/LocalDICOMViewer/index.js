import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

// Load the itk-wasm UMD module dynamically for the example.
// Normally, this will just go in the HTML <head>.
import vtkResourceLoader from '@kitware/vtk.js/IO/Core/ResourceLoader';

// vtk imports
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkITKHelper from '@kitware/vtk.js/Common/DataModel/ITKHelper';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';

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
instructions.innerText = 'Select a DICOM file from your local directory:';
instructions.style.margin = '0 0 10px 0';
instructions.style.fontSize = '14px';
controlContainer.appendChild(instructions);

const fileInput = document.createElement('input');
fileInput.type = 'file';
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
const imageMapper = vtkImageMapper.newInstance();
imageActor.setMapper(imageMapper);
renderer.addActor(imageActor);

// ----------------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------------
function setupVisualization(vtkImage) {
  try {
    console.log('Setting up visualization');

    // Set the image as input
    imageMapper.setInputData(vtkImage);

    // Set window/level
    const scalars = vtkImage.getPointData().getScalars();
    if (scalars) {
      const range = scalars.getRange();
      const maxWidth = range[1] - range[0];
      imageActor.getProperty().setColorWindow(maxWidth);
      const center = Math.round((range[0] + range[1]) / 2);
      imageActor.getProperty().setColorLevel(center);
    }

    // Reset camera to fit the image
    renderer.resetCamera();

    // Render
    renderWindow.render();

    statusLabel.innerText = 'Image loaded successfully.';
  } catch (error) {
    console.error('Error setting up visualization:', error);
    statusLabel.innerText = `Error: ${error.message}`;
  }
}

// ----------------------------------------------------------------------------
// File loading handler
// ----------------------------------------------------------------------------
async function loadDICOMFile(file) {
  if (!file) {
    statusLabel.innerText = 'No file selected.';
    return;
  }

  statusLabel.innerText = 'Loading file...';
  console.log(`Loading DICOM file: ${file.name}`);

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Use itk-wasm to read the DICOM file
    const { image: itkImage, webWorker } =
      await window.itk.readImageArrayBuffer(null, arrayBuffer, file.name);
    webWorker.terminate();

    // Convert to VTK image
    const vtkImage = vtkITKHelper.convertItkToVtkImage(itkImage);

    console.log('Loaded file:', file.name);
    console.log('VTK Image dimensions:', vtkImage.getDimensions());
    console.log('VTK Image spacing:', vtkImage.getSpacing());

    setupVisualization(vtkImage);
  } catch (error) {
    console.error('Error loading DICOM file:', error);
    statusLabel.innerText = `Error: ${error.message}`;
  }
}

// ----------------------------------------------------------------------------
// Event listeners
// ----------------------------------------------------------------------------
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  loadDICOMFile(file);
});

// After the itk-wasm UMD script has been loaded, `window.itk` provides the itk-wasm API.
vtkResourceLoader
  .loadScript(
    'https://cdn.jsdelivr.net/npm/itk-wasm@1.0.0-b.8/dist/umd/itk-wasm.js'
  )
  .then(() => {
    statusLabel.innerText = 'Ready. Please select a DICOM file.';
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
