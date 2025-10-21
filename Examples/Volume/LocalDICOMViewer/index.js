import '@kitware/vtk.js/Rendering/Profiles/Volume';

import vtkResourceLoader from '@kitware/vtk.js/IO/Core/ResourceLoader';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkITKHelper from '@kitware/vtk.js/Common/DataModel/ITKHelper';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';

const fileInput = document.createElement('input');
fileInput.type = 'file';
document.body.appendChild(fileInput);

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance();
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

const imageMapper = vtkImageMapper.newInstance();
const imageActor = vtkImageSlice.newInstance();
imageActor.setMapper(imageMapper);

//
//
//
//
//
// Setting this to false just to test the RGB images
//
//
//
//
//
//
imageActor.getProperty().setIndependentComponents(false);

renderer.addActor(imageActor);

function setupVisualization(vtkImage) {
  imageMapper.setInputData(vtkImage);
  renderer.resetCamera();
  renderWindow.render();
}

async function loadDICOMFile(file) {
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const { image: itkImage, webWorker } = await window.itk.readImageArrayBuffer(
    null,
    arrayBuffer,
    file.name
  );
  webWorker.terminate();

  const vtkImage = vtkITKHelper.convertItkToVtkImage(itkImage);
  setupVisualization(vtkImage);
}

fileInput.addEventListener('change', (event) => {
  loadDICOMFile(event.target.files[0]);
});

document.body.addEventListener('dragover', (event) => {
  event.preventDefault();
});

document.body.addEventListener('drop', (event) => {
  event.preventDefault();
  loadDICOMFile(event.dataTransfer.files[0]);
});

vtkResourceLoader.loadScript(
  'https://cdn.jsdelivr.net/npm/itk-wasm@1.0.0-b.8/dist/umd/itk-wasm.js'
);
