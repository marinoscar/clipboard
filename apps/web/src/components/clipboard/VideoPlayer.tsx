import { useState, useRef, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SpeedIcon from '@mui/icons-material/Speed';
import Forward10Icon from '@mui/icons-material/Forward10';
import Replay10Icon from '@mui/icons-material/Replay10';

interface VideoPlayerProps {
  src: string;
  title?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [skipIndicator, setSkipIndicator] = useState<'fwd' | 'back' | null>(null);

  // Speed menu
  const [speedAnchor, setSpeedAnchor] = useState<null | HTMLElement>(null);

  const video = videoRef.current;

  // Auto-hide controls after 3 seconds of inactivity
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  // Video event handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onDurationChange = () => setDuration(v.duration);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onVolumeChange = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('volumechange', onVolumeChange);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const skip = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
    setSkipIndicator(seconds > 0 ? 'fwd' : 'back');
    setTimeout(() => setSkipIndicator(null), 600);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleSeek = useCallback((_: Event | React.SyntheticEvent, value: number | number[]) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value as number;
    resetHideTimer();
  }, [resetHideTimer]);

  const handleVolumeChange = useCallback((_: Event | React.SyntheticEvent, value: number | number[]) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = value as number;
    v.volume = vol;
    v.muted = vol === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const setSpeed = useCallback((rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setSpeedAnchor(null);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  // Handle tap on left/right side for 10s skip
  const handleVideoClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const zone = x / width;

    if (zone < 0.3) {
      skip(-10);
    } else if (zone > 0.7) {
      skip(10);
    } else {
      togglePlay();
    }
  }, [skip, togglePlay]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (video) video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (video) video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, skip, toggleMute, toggleFullscreen, video]);

  return (
    <Box
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
      sx={{
        position: 'relative',
        bgcolor: '#000',
        borderRadius: isFullscreen ? 0 : 1,
        overflow: 'hidden',
        cursor: showControls ? 'default' : 'none',
        '&:hover': { cursor: 'default' },
        width: '100%',
      }}
    >
      {/* Video element with click overlay */}
      <Box
        onClick={handleVideoClick}
        sx={{ position: 'relative', width: '100%', cursor: 'pointer' }}
      >
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          playsInline
          style={{
            width: '100%',
            display: 'block',
            maxHeight: isFullscreen ? '100vh' : '70vh',
            objectFit: 'contain',
          }}
        />
      </Box>

      {/* Buffering spinner */}
      {buffering && (
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }}>
          <CircularProgress size={48} sx={{ color: 'white' }} />
        </Box>
      )}

      {/* Skip indicators */}
      {skipIndicator && (
        <Box sx={{
          position: 'absolute', top: '50%',
          left: skipIndicator === 'back' ? '15%' : undefined,
          right: skipIndicator === 'fwd' ? '15%' : undefined,
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          animation: 'fadeInOut 0.6s ease',
          '@keyframes fadeInOut': {
            '0%': { opacity: 0, transform: 'translateY(-50%) scale(0.8)' },
            '30%': { opacity: 1, transform: 'translateY(-50%) scale(1)' },
            '100%': { opacity: 0, transform: 'translateY(-50%) scale(1.2)' },
          },
        }}>
          {skipIndicator === 'back' ? (
            <Replay10Icon sx={{ fontSize: 48, color: 'white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
          ) : (
            <Forward10Icon sx={{ fontSize: 48, color: 'white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
          )}
        </Box>
      )}

      {/* Big play button when paused */}
      {!playing && !buffering && (
        <Box
          onClick={togglePlay}
          sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'rgba(0,0,0,0.6)', borderRadius: '50%',
            width: 64, height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
            '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)', bgcolor: 'rgba(0,0,0,0.75)' },
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 40, color: 'white' }} />
        </Box>
      )}

      {/* Controls overlay */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        pt: 4, pb: 1, px: { xs: 1, sm: 2 },
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        {/* Progress bar */}
        <Slider
          size="small"
          value={currentTime}
          min={0}
          max={duration || 1}
          onChange={handleSeek}
          sx={{
            color: 'primary.main',
            height: 4,
            p: '4px 0',
            '& .MuiSlider-thumb': {
              width: 12, height: 12,
              transition: 'width 0.15s, height 0.15s',
              '&:hover, &.Mui-focusVisible': { width: 16, height: 16 },
            },
            '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.3)' },
          }}
        />

        {/* Control buttons row */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 },
          mt: -0.5,
        }}>
          {/* Play/Pause */}
          <IconButton onClick={togglePlay} size="small" sx={{ color: 'white' }}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          {/* Skip back 10s */}
          <IconButton onClick={() => skip(-10)} size="small" sx={{ color: 'white' }}>
            <Replay10Icon fontSize="small" />
          </IconButton>

          {/* Skip forward 10s */}
          <IconButton onClick={() => skip(10)} size="small" sx={{ color: 'white' }}>
            <Forward10Icon fontSize="small" />
          </IconButton>

          {/* Volume */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={toggleMute} size="small" sx={{ color: 'white' }}>
              {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Slider
              size="small"
              value={muted ? 0 : volume}
              min={0}
              max={1}
              step={0.05}
              onChange={handleVolumeChange}
              sx={{
                width: { xs: 50, sm: 80 },
                color: 'white',
                '& .MuiSlider-thumb': { width: 10, height: 10 },
                '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.3)' },
              }}
            />
          </Box>

          {/* Time display */}
          <Typography variant="caption" sx={{ color: 'white', mx: 1, whiteSpace: 'nowrap', userSelect: 'none' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Playback speed */}
          <IconButton
            onClick={(e) => setSpeedAnchor(e.currentTarget)}
            size="small"
            sx={{ color: 'white', fontSize: '0.75rem', position: 'relative' }}
          >
            {playbackRate === 1 ? (
              <SpeedIcon fontSize="small" />
            ) : (
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'white' }}>
                {playbackRate}x
              </Typography>
            )}
          </IconButton>

          {/* Fullscreen */}
          <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'white' }}>
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Speed menu */}
      <Menu
        anchorEl={speedAnchor}
        open={Boolean(speedAnchor)}
        onClose={() => setSpeedAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {PLAYBACK_SPEEDS.map((rate) => (
          <MenuItem
            key={rate}
            selected={playbackRate === rate}
            onClick={() => setSpeed(rate)}
            dense
          >
            {rate === 1 ? 'Normal' : `${rate}x`}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
