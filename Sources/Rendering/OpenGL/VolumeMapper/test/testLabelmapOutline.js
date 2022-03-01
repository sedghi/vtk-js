import test from 'tape-catch';
import testUtils from 'vtk.js/Sources/Testing/testUtils';

import 'vtk.js/Sources/Rendering/Misc/RenderingAPIs';
import 'vtk.js/Sources/Rendering/Profiles/Volume';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';

import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkInteractorStyleMPRSlice from 'vtk.js/Sources/Interaction/Style/InteractorStyleMPRSlice';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindowInteractor from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';
import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';

// import baseline1 from './testVolumeMapperBounds.png';

function createLabelPipeline(backgroundImageData) {
  // Create a labelmap image the same dimensions as our background volume.
  const labelMapData = vtkImageData.newInstance(
    backgroundImageData.get('spacing', 'origin', 'direction')
  );

  labelMapData.computeTransforms();

  const values = new Uint8Array(backgroundImageData.getNumberOfPoints());
  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1, // labelmap with single component
    values,
  });
  labelMapData.getPointData().setScalars(dataArray);

  labelMapData.setDimensions(...backgroundImageData.getDimensions());
  labelMapData.setSpacing(...backgroundImageData.getSpacing());
  labelMapData.setOrigin(...backgroundImageData.getOrigin());
  labelMapData.setDirection(...backgroundImageData.getDirection());

  const labelMap = {
    actor: vtkVolume.newInstance(),
    mapper: vtkVolumeMapper.newInstance(),
    imageData: labelMapData,
    cfun: vtkColorTransferFunction.newInstance(),
    ofun: vtkPiecewiseFunction.newInstance(),
  };

  // Labelmap pipeline
  labelMap.mapper.setInputData(labelMapData);
  labelMap.actor.setMapper(labelMap.mapper);

  // Set up labelMap color and opacity mapping
  labelMap.cfun.addRGBPoint(1, 1, 0, 0); // label "1" will be red
  labelMap.cfun.addRGBPoint(2, 0, 1, 0); // label "2" will be green
  labelMap.ofun.addPoint(0, 0);
  labelMap.ofun.addPoint(1, 0.5, 0.5, 1.0); // Red will have an opacity of 0.2.
  labelMap.ofun.addPoint(2, 0.5, 0.5, 1.0); // Green will have an opacity of 0.2.
  labelMap.ofun.setClamping(false);

  labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
  labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);
  labelMap.actor.getProperty().setInterpolationTypeToNearest();
  labelMap.actor.getProperty().setUseLabelOutline(true);
  labelMap.actor.getProperty().setLabelOutlineThickness(3);

  return labelMap;
}

function fillBlobForThreshold(imageData, backgroundImageData) {
  const dims = imageData.getDimensions();
  const values = imageData.getPointData().getScalars().getData();

  const backgroundValues = backgroundImageData
    .getPointData()
    .getScalars()
    .getData();
  const size = dims[0] * dims[1] * dims[2];

  // Head
  const headThreshold = [324, 1524];
  for (let i = 0; i < size; i++) {
    if (
      backgroundValues[i] >= headThreshold[0] &&
      backgroundValues[i] < headThreshold[1]
    ) {
      values[i] = 1;
    }
  }

  // Bone
  const boneThreshold = [1200, 2324];
  for (let i = 0; i < size; i++) {
    if (
      backgroundValues[i] >= boneThreshold[0] &&
      backgroundValues[i] < boneThreshold[1]
    ) {
      values[i] = 2;
    }
  }

  imageData.getPointData().getScalars().setData(values);
}

test.onlyIfWebGL.only('Test Labelmap Outline', (t) => {
  const gc = testUtils.createGarbageCollector(t);
  t.ok('rendering', 'vtkVolumeMapper Labelmap Outline');

  // Create some control UI
  const container = document.querySelector('body');
  const renderWindowContainer = gc.registerDOMElement(
    document.createElement('div')
  );
  container.appendChild(renderWindowContainer);

  const fullScreenRenderWindow = vtkFullScreenRenderWindow.newInstance({
    background: [0.3, 0.3, 0.3],
  });
  const renderWindow = fullScreenRenderWindow.getRenderWindow();
  const renderer = fullScreenRenderWindow.getRenderer();

  const istyle = vtkInteractorStyleMPRSlice.newInstance();
  renderWindow.getInteractor().setInteractorStyle(istyle);

  const actor = gc.registerResource(vtkVolume.newInstance());
  const mapper = gc.registerResource(vtkVolumeMapper.newInstance());
  mapper.setSampleDistance(0.7);
  actor.getProperty().setInterpolationTypeToNearest();

  actor.setMapper(mapper);

  const reader = vtkHttpDataSetReader.newInstance({
    fetchGzip: true,
  });

  const ofun = vtkPiecewiseFunction.newInstance();
  ofun.addPoint(0, 0);
  ofun.addPoint(1, 1.0);
  actor.getProperty().setScalarOpacity(0, ofun);

  mapper.setInputConnection(reader.getOutputPort());

  const glwindow = gc.registerResource(vtkOpenGLRenderWindow.newInstance());
  glwindow.setContainer(renderWindowContainer);
  renderWindow.addView(glwindow);
  glwindow.setSize(400, 400);

  reader.setUrl(`${__BASE_PATH__}/Data/volume/headsq.vti`).then(() => {
    reader.loadData().then(() => {
      renderer.addVolume(actor);

      renderer.resetCamera();
      const data = reader.getOutputData();

      const labelMap = createLabelPipeline(data);

      const sourceDataRGBTransferFunction = actor
        .getProperty()
        .getRGBTransferFunction(0);
      sourceDataRGBTransferFunction.setMappingRange(324, 2324);

      fillBlobForThreshold(labelMap.imageData, data);

      istyle.setVolumeMapper(mapper);

      const labelmapActor = labelMap.actor;
      renderer.addVolume(labelmapActor);
      renderer.getActiveCamera().zoom(2);
      renderer.getActiveCamera().setViewUp(1, 0, 0);

      glwindow.captureNextImage().then((image) => {
        debugger;
        testUtils.compareImages(
          image,
          // [baseline1],
          'Rendering/Core/VolumeMapper/testLabelmapOutline',
          t,
          1.5,
          gc.releaseResources
        );
      });

      renderWindow.render();
    });
  });
});
