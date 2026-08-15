import { useEffect, useState, useCallback, useRef } from 'react';
import Wave from 'react-wavify';

interface WaveCanvasProps {
  waveMode: 'dynamic' | 'static';
  explosionTrigger: number;
}

interface Droplet {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

export function WaveCanvas({ waveMode, explosionTrigger }: WaveCanvasProps) {
  const isDynamic = waveMode === 'dynamic';
  
  // Keep control points constant (points: 5) to prevent layout recalculation jumps
  const [waveConfig, setWaveConfig] = useState({
    height: 100,
    amplitude: 15,
    speed: 0.12,
    points: 5
  });

  // Keep a mutable ref of the current config to avoid callback re-registrations
  const configRef = useRef(waveConfig);
  useEffect(() => {
    configRef.current = waveConfig;
  }, [waveConfig]);

  const activeAnimRef = useRef<number | null>(null);
  const [isExploding, setIsExploding] = useState(false);
  const [isWaveActive, setIsWaveActive] = useState(false); // Keeps high amplitude/speed active during descent
  const [droplets, setDroplets] = useState<Droplet[]>([]);

  // Smoothly interpolates the wave configuration options using requestAnimationFrame
  const animateToConfig = useCallback((targetHeight: number, targetAmp: number, targetSpeed: number, durationMs = 1000) => {
    if (activeAnimRef.current !== null) {
      cancelAnimationFrame(activeAnimRef.current);
    }

    const startTime = performance.now();
    const startHeight = configRef.current.height;
    const startAmp = configRef.current.amplitude;
    const startSpeed = configRef.current.speed;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // easeOutCubic curve for smooth decelerating transition
      const ease = 1 - Math.pow(1 - progress, 3);

      setWaveConfig({
        height: startHeight + (targetHeight - startHeight) * ease,
        amplitude: startAmp + (targetAmp - startAmp) * ease,
        speed: startSpeed + (targetSpeed - startSpeed) * ease,
        points: 5
      });

      if (progress < 1) {
        activeAnimRef.current = requestAnimationFrame(tick);
      } else {
        activeAnimRef.current = null;
      }
    };

    activeAnimRef.current = requestAnimationFrame(tick);
  }, []);

  // Monitor waveMode baseline updates and reset transitions
  useEffect(() => {
    if (isWaveActive) return; // Wait until descent is fully completed before returning to calm/dynamic baseline
    
    if (isDynamic) {
      animateToConfig(150, 35, 0.22, 3000); // Very slow 3s transition back to dynamic baseline config
    } else {
      animateToConfig(80, 10, 0.08, 3000);  // Very slow 3s transition back to static/calm baseline config
    }
  }, [isDynamic, isWaveActive, animateToConfig]);

  // Unified function to execute splash effect
  const executeSplash = useCallback(() => {
    setIsExploding(true);
    setIsWaveActive(true);
    
    // Shoot wave parameters up quickly (400ms duration)
    animateToConfig(200, 75, 0.45, 400);

    // Generate splatter droplets feedback on the screen
    const newDroplets: Droplet[] = Array.from({ length: 38 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 90 + 5,
      y: Math.random() * 60 + 10,
      size: Math.random() * 14 + 8,
      delay: Math.random() * 0.35
    }));
    setDroplets(newDroplets);

    // Retract wave translation (starts translating down) after 1300ms
    const resetExplodingTimer = setTimeout(() => {
      setIsExploding(false);
    }, 1300);

    // Keep waveConfig high until translate-down animation is fully completed (1300ms + 4500ms transition = 5800ms)
    const resetWaveActiveTimer = setTimeout(() => {
      setIsWaveActive(false);
    }, 5800);

    // Clean up droplets after 3.2 seconds
    const clearTimer = setTimeout(() => {
      setDroplets([]);
    }, 3200);

    return { resetExplodingTimer, resetWaveActiveTimer, clearTimer };
  }, [animateToConfig]);

  // Monitor manual transition explosionTrigger
  useEffect(() => {
    if (explosionTrigger === 0) return;
    
    let timers: { resetExplodingTimer: number; resetWaveActiveTimer: number; clearTimer: number } | null = null;
    const deferTimer = setTimeout(() => {
      timers = executeSplash();
    }, 0);

    return () => {
      clearTimeout(deferTimer);
      if (timers) {
        clearTimeout(timers.resetExplodingTimer);
        clearTimeout(timers.resetWaveActiveTimer);
        clearTimeout(timers.clearTimer);
      }
    };
  }, [explosionTrigger, executeSplash]);

  // Automatic random splash loop (every 8 to 15 seconds)
  useEffect(() => {
    let timeoutId: number;
    let activeTimers: { resetExplodingTimer: number; resetWaveActiveTimer: number; clearTimer: number } | null = null;

    const runLoop = () => {
      activeTimers = executeSplash();
      
      // Schedule next random splash between 8 and 15 seconds
      const nextDelay = Math.random() * 7000 + 8000;
      timeoutId = setTimeout(runLoop, nextDelay);
    };

    // Initial random delay for first automatic splash
    const initialDelay = Math.random() * 6000 + 6000;
    timeoutId = setTimeout(runLoop, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      if (activeTimers) {
        clearTimeout(activeTimers.resetExplodingTimer);
        clearTimeout(activeTimers.resetWaveActiveTimer);
        clearTimeout(activeTimers.clearTimer);
      }
      if (activeAnimRef.current !== null) {
        cancelAnimationFrame(activeAnimRef.current);
      }
    };
  }, [executeSplash]);

  return (
    <>
      {/* Absolute background wave canvas - animated smoothly via GPU translate transform */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '450px',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'hidden',
        transform: isExploding ? 'translateY(0px) scaleY(1.5)' : 'translateY(150px) scaleY(1.0)',
        transformOrigin: 'bottom center',
        transition: isExploding 
          ? 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.2)' 
          : 'transform 4.5s cubic-bezier(0.25, 0.8, 0.25, 1)',
        willChange: 'transform'
      }}>
        {/* Background Deep Ocean Wave Layer */}
        <Wave
          fill="url(#deepOceanGrad)"
          paused={false}
          style={{ display: 'flex', position: 'absolute', bottom: 0, width: '100%', height: '100%' }}
          options={{
            height: waveConfig.height,
            amplitude: waveConfig.amplitude,
            speed: waveConfig.speed,
            points: waveConfig.points
          }}
        >
          <defs>
            <linearGradient id="deepOceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(33, 150, 243, 0.6)" />
              <stop offset="100%" stopColor="rgba(13, 71, 161, 0.95)" />
            </linearGradient>
          </defs>
        </Wave>

        {/* Foreground Bright Splash Wave Layer (mirrored) */}
        <Wave
          fill="url(#foreOceanGrad)"
          paused={false}
          style={{ display: 'flex', position: 'absolute', bottom: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
          options={{
            height: waveConfig.height - 15,
            amplitude: waveConfig.amplitude * 0.8,
            speed: waveConfig.speed * 1.2,
            points: waveConfig.points
          }}
        >
          <defs>
            <linearGradient id="foreOceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(144, 202, 249, 0.55)" />
              <stop offset="100%" stopColor="rgba(33, 150, 243, 0.85)" />
            </linearGradient>
          </defs>
        </Wave>
      </div>

      {/* Screen Splatter Dripping Droplets Overlay */}
      {droplets.length > 0 && (
        <div className="splatter-container">
          {droplets.map((drop) => (
            <div
              key={drop.id}
              className="splatter-drop"
              style={{
                left: `${drop.x}%`,
                top: `${drop.y}%`,
                width: `${drop.size}px`,
                height: `${drop.size * 1.2}px`,
                animationDelay: `${drop.delay}s`
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default WaveCanvas;
