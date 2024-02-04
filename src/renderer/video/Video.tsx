import { Box, Slider, Typography, Stack } from '@mui/material';
import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';

import { convertTimestampToString } from '../shared/Util';
import { useResizeDetector } from 'react-resize-detector';
import { useDebouncedCallback } from 'use-debounce';
import makeStyles from '@mui/styles/makeStyles';
import VideoSideBar from './VideoSideBar';
import { setZoomWindow, useImage, useVideoPosition } from './VideoSettings';
import VideoOverlay, {
  getCourseConfig,
  useAdjustingOverlay,
} from './VideoOverlay';
import { Rect } from 'renderer/shared/AppTypes';

const useStyles = makeStyles({
  text: {
    zIndex: 1,
    background: '#ffffffa0',
    color: 'black',
    border: '1px solid black',
    height: 'fit-content',
    padding: '0.2em',
  },
  computedtext: {
    zIndex: 1,
    background: '#ffffffa0',
    color: 'black',
    border: '1px solid red',
    height: 'fit-content',
    padding: '0.2em',
  },
});

interface CalPoint {
  ts: number;
  px: number;
  scale: number;
}

interface ZoomState {
  mouseMove: number;
  mouseDownClientY: number;
  mouseDownPositionY: number;
  mouseDownPositionX: number;
  mouseDown: boolean | undefined;
  initialPinchDistance: number;
  isPinching: boolean;
  isZooming: boolean;
  initialPinchRange: { min: number; max: number };
  zoomWindow: Rect; // Current applied zoom window
  zoomStartWindow: Rect; // The zoom window when zooming started
  imageScale: number;
  imageLoaded: boolean;
  scale: number;
  calPointLeft: CalPoint;
  calPointRight: CalPoint;
}

const VideoScrubber = () => {
  const [videoPosition, setVideoPosition] = useVideoPosition();
  const [image] = useImage();
  const numFrames = image.numFrames;

  const handleSlider = (_event: Event, value: number | number[]) => {
    const newValue = value as number;
    if (_event.type !== 'mousemove' || newValue < 0 || newValue >= numFrames) {
      // extraneous events sometimes come into the slider.  Ignore them.
      return;
    }
    setVideoPosition({ ...videoPosition, frameNum: newValue });
  };
  console.log(`frameNum: ${videoPosition.frameNum}/${numFrames}`);

  return (
    <div style={{ paddingLeft: '1em', paddingRight: '1em', width: '100%' }}>
      <Slider
        value={videoPosition.frameNum}
        min={0}
        max={numFrames - 1}
        onChange={handleSlider}
        aria-labelledby="video-scrubber"
        sx={{ width: '100%' }}
      />
    </div>
  );
};
const VideoImage: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const [image] = useImage();
  const classes = useStyles();
  const [, forceRender] = useReducer((s) => s + 1, 0);
  const [computedTime, setComputedTime] = useState(0);
  const [, setVideoPosition] = useVideoPosition();
  const [adjustingOverlay] = useAdjustingOverlay();
  const mouseTracking = useRef<ZoomState>({
    zoomWindow: { x: 0, y: 0, width: 0, height: 0 },
    zoomStartWindow: { x: 0, y: 0, width: 0, height: 0 },
    imageScale: 1,
    scale: 1,
    imageLoaded: false,
    mouseDownClientY: 0,
    mouseDownPositionY: 0,
    mouseDownPositionX: 0,
    mouseMove: 0,
    mouseDown: undefined,
    isPinching: false,
    isZooming: false,
    initialPinchDistance: 0,
    initialPinchRange: { min: 0, max: 100 },
    calPointLeft: { ts: 0, px: 0, scale: 1 },
    calPointRight: { ts: 0, px: 0, scale: 1 },
  });

  const infoRowHeight = 0; // 40;
  height = height - infoRowHeight;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvas = useRef(document.createElement('canvas'));

  const setScale = useCallback((scale: number) => {
    mouseTracking.current.scale = scale;
    drawContent();
  }, []);

  const initScaling = useCallback(() => {
    setScale(1);
    mouseTracking.current.mouseDown = false;
    mouseTracking.current.isPinching = false;
    mouseTracking.current.isZooming = false;
    mouseTracking.current.calPointLeft.ts = 0;
    mouseTracking.current.calPointRight.ts = 0;

    mouseTracking.current.zoomWindow = {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    };
    mouseTracking.current.zoomStartWindow = mouseTracking.current.zoomWindow;
    setZoomWindow(mouseTracking.current.zoomWindow);
  }, [image.width, image.height]);

  useEffect(() => {
    initScaling();
  }, [image.width, image.height]);

  useEffect(() => {
    offscreenCanvas.current.width = image.width;
    offscreenCanvas.current.height = image.height;
    const ctx = offscreenCanvas.current?.getContext('2d');
    if (ctx && image.width) {
      ctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(image.data),
          image.width,
          image.height
        ),
        0,
        0
      );
      mouseTracking.current.imageLoaded = true;
      drawContent();
    } else {
      mouseTracking.current.imageLoaded = false;
    }
  }, [image]);

  const { zoomWindow, isZooming } = mouseTracking.current;
  let imgScale = 1.0;
  let destWidth = width;
  let destHeight = height;
  if (isZooming) {
    const scaleX = width / zoomWindow.width;
    const scaleY = height / zoomWindow.height;
    imgScale = Math.min(scaleX, scaleY);
    destHeight = imgScale * zoomWindow.height;
    destWidth = imgScale * zoomWindow.width;
  } else if (image.width > 0 && image.height > 0) {
    const scaleX = width / image.width;
    const scaleY = height / image.height;
    imgScale = Math.min(scaleX, scaleY);
    destHeight = imgScale * image.height;
    destWidth = imgScale * image.width;
  }
  mouseTracking.current.imageScale = imgScale;

  const xPadding = (width - destWidth) / 2;

  const drawContent = useDebouncedCallback(() => {
    if (mouseTracking.current.imageLoaded && canvasRef?.current) {
      const canvas = canvasRef.current;
      if (canvas.width <= 1) {
        return;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);

        const { zoomWindow } = mouseTracking.current;
        if (image.width) {
          ctx.drawImage(
            // imageFrame.current,
            offscreenCanvas.current,
            zoomWindow.x,
            zoomWindow.y,
            zoomWindow.width,
            zoomWindow.height,
            (canvas.width - destWidth) / 2, // center the image
            0,
            destWidth,
            destHeight
          );

          ctx.beginPath();

          // Draw a border as a Rectangle
          ctx.strokeStyle = 'black'; // You can choose any color
          ctx.lineWidth = 1; // Width of the border
          ctx.strokeRect(
            (canvas.width - destWidth) / 2,
            0,
            destWidth - 1,
            destHeight - 1
          );

          // Draw measurement markers
          if (mouseTracking.current.calPointLeft.ts !== 0) {
            const x =
              canvas.width / 2 +
              (mouseTracking.current.calPointLeft.px *
                mouseTracking.current.scale) /
                mouseTracking.current.calPointLeft.scale;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, destHeight);
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          if (mouseTracking.current.calPointRight.ts !== 0) {
            const x =
              canvas.width / 2 +
              (mouseTracking.current.calPointRight.px *
                mouseTracking.current.scale) /
                mouseTracking.current.calPointRight.scale;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, destHeight);
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }
  }, 10);

  useEffect(() => {
    drawContent();
  }, [width, height]);

  useEffect(() => {
    // initialize zoom tracking if not already initialized
    if (mouseTracking.current.zoomWindow.width !== 0) {
      return;
    }
    mouseTracking.current.zoomWindow = {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    };
    mouseTracking.current.zoomStartWindow = mouseTracking.current.zoomWindow;

    setZoomWindow(mouseTracking.current.zoomWindow);
  }, [image]);

  const handleSingleClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    const mousePositionY =
      event.clientY - event.currentTarget.getBoundingClientRect().top;
    if (mousePositionY < 30 || !event.shiftKey) {
      return;
    }
    event.preventDefault();
    const mousePositionX =
      event.clientX - event.currentTarget.getBoundingClientRect().width / 2;

    const { calPointLeft, calPointRight } = mouseTracking.current;
    const calPoint = mousePositionX < 0 ? calPointLeft : calPointRight;

    calPoint.ts = image.timestamp;
    calPoint.px = mousePositionX;
    calPoint.scale = mouseTracking.current.scale;
    if (calPointLeft.ts && calPointRight.ts) {
      const deltaT = calPointRight.ts - calPointLeft.ts;
      const deltaPx =
        calPointRight.px * calPointRight.scale -
        calPointLeft.px * calPointLeft.scale;
      setComputedTime(
        Math.round(
          calPointLeft.ts +
            ((-calPointLeft.px * calPointLeft.scale) / deltaPx) * deltaT
        )
      );
    }
    // console.log(
    //   `"${convertTimestampToString(calPoint.ts)}",${
    //     mousePositionX / calPoint.scale
    //   }`
    // );
    drawContent();
    forceRender();
  };

  const handleDragStart = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    event.preventDefault();
  };

  const handleDoubleClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    const mousePositionY =
      event.clientY - event.currentTarget.getBoundingClientRect().top;
    if (mousePositionY < 30) {
      event.preventDefault();
      return;
    }
    initScaling();
  };

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      mouseTracking.current.mouseDownClientY = event.clientY;
      const mousePositionY = Math.min(
        destHeight,
        Math.max(
          0,
          event.clientY - event.currentTarget.getBoundingClientRect().top
        )
      );

      mouseTracking.current.mouseDown = true;
      mouseTracking.current.zoomStartWindow = mouseTracking.current.zoomWindow;

      // Reference back to the original frame x and y
      const yScale = mouseTracking.current.zoomWindow.width / destWidth;
      mouseTracking.current.mouseDownPositionY =
        mouseTracking.current.zoomWindow.y + mousePositionY * yScale;

      // compute the x pos of the finish line in the frame before scalechanges
      const { top, bottom } = getCourseConfig().finish;
      const x1 = image.width / 2 + top;
      const x2 = image.width / 2 + bottom;

      mouseTracking.current.mouseDownPositionX =
        x1 +
        (x2 - x1) * (mouseTracking.current.mouseDownPositionY / image.height);
    },
    [image, xPadding, destWidth]
  );

  const doZoom = useCallback(
    /**
     * Zoom the image based on the initial mouse down position.  The
     * approximate finish line position is maintained on the x axis while the
     * y axis is zoomed around the y click point.
     *
     * @param zoomFactor New zoom factor
     */
    (zoomFactor: number) => {
      // Compute new sizes.  X and Y are scaled equally to maintain aspect ratio
      const newWidth = image.width / zoomFactor;
      const newHeight = image.height / zoomFactor;

      // mouseDownPositionY represents the y position in the image coordinates where centering should occur
      let newY = mouseTracking.current.mouseDownPositionY - newHeight / 2; // force to middle
      newY = Math.max(0, newY); // make sure we don't go off the top
      newY = Math.min(newY, image.height - newHeight); // make sure we don't go off the bottom

      const priorXScale = mouseTracking.current.zoomWindow.width / destWidth;
      const newXScale = Math.min(image.width, newWidth) / destWidth;

      const screenPixelsToFinishLine =
        (mouseTracking.current.mouseDownPositionX -
          mouseTracking.current.zoomWindow.x) /
        priorXScale;

      const newX =
        mouseTracking.current.mouseDownPositionX -
        screenPixelsToFinishLine * newXScale;

      // Apply the new zoom window and scale
      mouseTracking.current.zoomWindow = {
        x: newX,
        y: newY,
        width: Math.min(image.width, newWidth),
        height: Math.min(image.height, newHeight),
      };

      setZoomWindow(mouseTracking.current.zoomWindow);
      // console.log(JSON.stringify(mouseTracking.current, null, 2));
      setScale(zoomFactor);
    },
    [image, destHeight, destWidth]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (event.shiftKey) {
        // handleSingleClick(event);
        return;
      }
      // dont trigger mouse down move actions until we have moved slightly. This avoids
      // accidental zooming on just a click
      const downMoveY = Math.abs(
        mouseTracking.current.mouseDownClientY - event.clientY
      );
      if (mouseTracking.current.mouseDown && downMoveY > 10) {
        mouseTracking.current.isZooming = true;
        const deltaY = event.movementY;
        const newScale = Math.max(
          1,
          mouseTracking.current.scale + deltaY * 0.01
        );
        // Adjust the scale based on the mouse movement
        doZoom(newScale);
      }
    },
    [image]
  );

  const handleMouseUp = useCallback(() => {
    mouseTracking.current.mouseDown = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    // Cleanup the mouseup listener on unmount
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  const moveRight = useCallback(() => {
    setVideoPosition((prev) => {
      return {
        ...prev,
        frameNum: Math.min(image.numFrames - 1, prev.frameNum + 1),
      };
    });
  }, [setVideoPosition, image]);
  const moveLeft = useCallback(() => {
    setVideoPosition((prev) => {
      return {
        ...prev,
        frameNum: Math.max(0, prev.frameNum - 1),
      };
    });
  }, [setVideoPosition, image]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
        case '>':
        case '.':
          moveRight();
          break;
        case 'ArrowLeft':
        case '<':
        case ',':
          moveLeft();
          break;
        default:
          break; // ignore
      }
    },
    [moveLeft, moveRight]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        moveRight();
      } else if (event.deltaY > 0) {
        moveLeft();
      }
    },
    [moveLeft, moveRight]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    // Cleanup the keydown listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <Stack direction="column">
      {/* <Box
        sx={{
          height: infoRowHeight,
          width: '100%',
          display: 'flex',
          padding: '2px',
        }}
      >
        <div style={{ flex: 1 }} />
        <Stack direction="row">
          <Typography onClick={moveLeft} className={classes.text}>
            &nbsp;&lt;&nbsp;
          </Typography>
          <Typography className={classes.text}>
            {convertTimestampToString(image.timestamp)}
          </Typography>
          <Typography onClick={moveRight} className={classes.text}>
            &nbsp;&gt;&nbsp;
          </Typography>
        </Stack>
        <div style={{ flex: 1 }} />
      </Box> */}
      <Box
        onWheel={adjustingOverlay ? undefined : handleWheel}
        onMouseDown={adjustingOverlay ? undefined : handleMouseDown}
        onMouseMove={adjustingOverlay ? undefined : handleMouseMove}
        onMouseUp={adjustingOverlay ? undefined : handleMouseUp}
        onDragStart={adjustingOverlay ? undefined : handleDragStart}
        onDoubleClick={handleDoubleClick}
        onClick={adjustingOverlay ? undefined : handleSingleClick}
        sx={{
          // margin: '16px', // Use state variable for padding
          width: `100%`, // Fill the width of the content area
          height: `100%`, // Fill the height of the content area
          maxHeight: `100%`,
          display: 'flex', // Use flexbox for centering
          // justifyContent: 'center', // Center horizontally
          alignItems: 'top', //  vertically
          overflow: 'hidden', // In case the image is too big
        }}
      >
        <Stack
          direction="column"
          sx={{
            width: `${width}px`,
            height: `${height}px`,
            alignItems: 'center',
          }}
        >
          <Stack direction="row">
            <div />
            <Typography onClick={moveLeft} className={classes.text}>
              &nbsp;&lt;&nbsp;
            </Typography>
            <Typography className={classes.text}>
              {convertTimestampToString(image.timestamp)}
            </Typography>
            <Typography onClick={moveRight} className={classes.text}>
              &nbsp;&gt;&nbsp;
            </Typography>
            <div style={{ flex: 1 }} />
          </Stack>
          {computedTime
            ? mouseTracking.current.calPointLeft.ts &&
              mouseTracking.current.calPointRight.ts && (
                <Typography className={classes.computedtext} align="center">
                  {convertTimestampToString(computedTime)}
                </Typography>
              )
            : null}
        </Stack>
        <canvas
          ref={canvasRef}
          width={`${width}px`}
          height={`${height}px`}
          style={{
            position: 'absolute', // keeps the size from influencing the parent size
          }}
        />
        <VideoOverlay
          width={width}
          height={height}
          destHeight={destHeight}
          destWidth={destWidth}
        />
      </Box>
    </Stack>
  );
};

const Video = () => {
  const { width, height, ref } = useResizeDetector();
  const sidebarWidth = 150;
  return (
    <div
      style={{
        // margin: '16px', // Use state variable for padding
        width: '100%', // Fill the width of the content area
        height: '100%', // Fill the height of the content area
        display: 'flex', // Use flexbox for centering
        justifyContent: 'center', // Center horizontally
        alignItems: 'center', // Center vertically
        overflow: 'hidden', // In case the image is too big
        flexDirection: 'column',
      }}
    >
      <VideoScrubber />
      <div ref={ref} style={{ width: '100%', height: '100%' }}>
        <Stack direction="row">
          <VideoImage
            width={(width || sidebarWidth + 1) - sidebarWidth}
            height={height || 1}
          />
          <VideoSideBar width={sidebarWidth} />
        </Stack>
      </div>
    </div>
  );
};

export default Video;
