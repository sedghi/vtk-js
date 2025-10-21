# Local DICOM Viewer

This example demonstrates how to load and visualize DICOM images from your local file system.

## Features

- Load single or multiple DICOM files from local directory
- Interactive slice scrolling (mouse wheel)
- Pan and zoom controls
- Automatic window/level adjustment per slice

## Usage

1. Open the example in your browser
2. Click "Choose Files" to select one or more DICOM files (.dcm or .dicom)
3. The viewer will automatically load and display the images
4. Use mouse controls to interact:
   - **Left button drag**: Pan
   - **Right button drag**: Zoom
   - **Mouse wheel**: Scroll through slices (if multiple files loaded)

## How it Works

The example uses:
- **itk-wasm**: To parse DICOM files directly in the browser
- **vtkITKHelper**: To convert ITK images to VTK format
- **vtkImageArrayMapper**: To render multiple 2D image slices
- **vtkCollection**: To manage multiple images as a series

## Code Overview

The key steps for loading local DICOM files are:

1. **Create a file input** to let users select files:
```javascript
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.multiple = true;
fileInput.accept = '.dcm,.dicom';
```

2. **Read files as ArrayBuffer**:
```javascript
const arrayBuffer = await file.arrayBuffer();
```

3. **Parse with itk-wasm**:
```javascript
const { image: itkImage, webWorker } = 
  await window.itk.readImageArrayBuffer(null, arrayBuffer, file.name);
webWorker.terminate();
```

4. **Convert to VTK image**:
```javascript
const vtkImage = vtkITKHelper.convertItkToVtkImage(itkImage);
```

5. **Display with vtkImageArrayMapper**:
```javascript
imageArray.forEach((img) => collection.addItem(img));
imageMapper.setInputData(collection);
```

## Note

This example requires itk-wasm to be loaded, which is done automatically via CDN.

