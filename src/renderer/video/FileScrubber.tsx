import {
  Button,
  Slider,
  SliderThumb,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useSelectedIndex } from './VideoSettings';
import { openSelectedFile, useDirList } from './VideoFileUtils';

interface CustomThumbComponentProps extends React.HTMLAttributes<unknown> {}

function CustomThumbComponent(props: CustomThumbComponentProps) {
  const { children, ...other } = props;
  return (
    <SliderThumb {...other}>
      {children}
      <div style={{ width: 24, height: 24, backgroundColor: 'green' }} />
    </SliderThumb>
  );
}
interface SxPropsArgs {
  sx?: SxProps<Theme>;
}

const FileScrubber: React.FC<SxPropsArgs> = ({ sx }) => {
  const [fileIndex, setFileIndex] = useSelectedIndex();
  const [dirList] = useDirList();
  const numFiles = dirList.length;

  const moveToIndex = (index: number) => {
    index = Math.max(0, Math.min(index, numFiles - 1));
    setFileIndex(index);
    openSelectedFile(dirList[index]);
  };

  const handleSlider = (_event: Event, value: number | number[]) => {
    let newValue = value as number;
    moveToIndex(newValue);
  };

  const prevFile = () => {
    moveToIndex(fileIndex - 1);
  };
  const nextFile = () => {
    moveToIndex(fileIndex + 1);
  };

  return (
    <Stack
      direction="row"
      style={{
        alignItems: 'center',
        width: '100%',
        paddingLeft: '0.5em',
        paddingRight: '0.5em',
        display: 'flex',
      }}
      sx={sx}
    >
      <Button
        variant="contained"
        onClick={prevFile}
        size="small"
        sx={{
          height: 24,
          m: 0,
          minWidth: 24,
          background: '#19857b',
        }}
      >
        <ArrowBackIcon fontSize={'small'} />
      </Button>
      <Slider
        value={fileIndex}
        min={0}
        max={numFiles - 1}
        onChange={handleSlider}
        aria-labelledby="file-scrubber"
        sx={{
          marginLeft: '1em',
          marginRight: '1em',
          flex: 1,
        }}
        color="secondary"
        slots={{ thumb: CustomThumbComponent }}
        track={false}
        marks
        valueLabelFormat={() => 'test'}
      />
      <Button
        variant="contained"
        onClick={nextFile}
        size="small"
        sx={{
          height: 24,
          m: 0,
          minWidth: 24,
          background: '#19857b',
        }}
      >
        <ArrowForwardIcon fontSize={'small'} />
      </Button>
    </Stack>
  );
};

export default FileScrubber;
