import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Waves, Droplet, Archive } from 'lucide-react';
import { useTranslation } from './hooks/useTranslation';
import { usePhotoSession } from './hooks/usePhotoSession';
import WaveCanvas from './components/photobooth/WaveCanvas';

interface FrameLayout {
  id: string;
  nameKey: 'stripVertical' | 'grid2x2' | 'singleClassic';
  slots: number;
  cutsText: string;
  badge?: string;
}

const FRAME_LAYOUTS: FrameLayout[] = [
  { id: 'classic', nameKey: 'stripVertical', slots: 3, cutsText: '3 Cuts' },
  { id: 'grid', nameKey: 'grid2x2', slots: 4, cutsText: '4 Cuts', badge: 'STANDARD' },
  { id: 'single', nameKey: 'singleClassic', slots: 1, cutsText: '1 Cut' }
];

export function App() {
  const testUnusedVar = "This is a mock code smell for AI review test";
  const { t, lang, changeLanguage } = useTranslation();
  const {
    photos,
    initSession,
    resetSession
  } = usePhotoSession();

  const [screen, setScreen] = useState<'welcome' | 'frame-select' | 'initialized-placeholder'>('welcome');
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState<number>(1); // default selection is "WIDE GRID" (index 1)
  const [waveMode, setWaveMode] = useState<'dynamic' | 'static'>('dynamic');
  const [explosionTrigger, setExplosionTrigger] = useState(0);

  const selectedLayout = FRAME_LAYOUTS[selectedLayoutIndex];

  const handleStartSession = () => {
    setExplosionTrigger((prev) => prev + 1);
    setTimeout(() => {
      setScreen('frame-select');
    }, 250);
  };

  const handleConfirmLayout = () => {
    setExplosionTrigger((prev) => prev + 1);
    setTimeout(() => {
      initSession(selectedLayout.slots);
      setScreen('initialized-placeholder');
    }, 250);
  };

  const handleRestart = () => {
    resetSession();
    setScreen('welcome');
  };

  const handlePrevLayout = () => {
    setSelectedLayoutIndex((prev) => (prev > 0 ? prev - 1 : FRAME_LAYOUTS.length - 1));
  };

  const handleNextLayout = () => {
    setSelectedLayoutIndex((prev) => (prev < FRAME_LAYOUTS.length - 1 ? prev + 1 : 0));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      
      {/* Absolute background wave canvas */}
      <WaveCanvas waveMode={waveMode} explosionTrigger={explosionTrigger} />

      {/* Top Header Bar */}
      <header style={{
        padding: '24px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        {/* Top Left: Logo/Text "OCEAN FLOW" aligned with language selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Waves size={24} style={{ color: 'var(--color-abyss-blue)' }} />
            <span style={{ fontWeight: '800', fontSize: '1.2rem', letterSpacing: '1.5px', color: 'var(--color-abyss-blue)' }}>
              OCEAN FLOW
            </span>
          </div>
          
          {/* Vertical divider */}
          <div style={{ width: '1.5px', height: '18px', backgroundColor: 'rgba(13, 71, 161, 0.25)' }} />
          
          {/* Simple EN / ID language switcher */}
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', fontWeight: '800', letterSpacing: '0.5px' }}>
            <span 
              onClick={() => changeLanguage('en')} 
              style={{ 
                cursor: 'pointer', 
                color: lang === 'en' ? 'var(--color-abyss-blue)' : '#B0BEC5', 
                transition: 'color 0.2s' 
              }}
            >
              EN
            </span>
            <span style={{ color: 'rgba(13, 71, 161, 0.2)' }}>/</span>
            <span 
              onClick={() => changeLanguage('id')} 
              style={{ 
                cursor: 'pointer', 
                color: lang === 'id' ? 'var(--color-abyss-blue)' : '#B0BEC5', 
                transition: 'color 0.2s' 
              }}
            >
              ID
            </span>
          </div>
        </div>
        
        {/* Top Right Buttons: Wave Toggle & Archive Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="wave-control-toggle">
            <button 
              className={`wave-toggle-btn ${waveMode === 'static' ? 'active' : ''}`}
              onClick={() => setWaveMode('static')}
            >
              {lang === 'id' ? 'Air Tenang' : 'Calm Water'}
            </button>
            <button 
              className={`wave-toggle-btn ${waveMode === 'dynamic' ? 'active' : ''}`}
              onClick={() => setWaveMode('dynamic')}
            >
              {lang === 'id' ? 'Ombak Dinamis' : 'Dynamic Waves'}
            </button>
          </div>

          <button 
            className="history-btn"
            onClick={() => alert(lang === 'id' ? 'Belum ada riwayat arsip. Mulai sesi untuk mengambil foto!' : 'No archived photos found. Start session to take photos!')}
            title="Arsip Sesi"
            style={{ marginTop: '12px' }}
          >
            <Archive size={20} />
          </button>
        </div>
      </header>

      {/* Content wrapper */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px 20px 80px 20px',
        zIndex: 8
      }}>
        
        {/* WELCOME SCREEN */}
        {screen === 'welcome' && (
          <div className="animate-fade-in" style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            maxWidth: '650px'
          }}>
            {/* Title: Stylized bold rounded font */}
            <h1 style={{
              fontSize: '4.5rem',
              fontWeight: '900',
              lineHeight: '1.1',
              color: 'var(--color-abyss-blue)',
              fontFamily: '"Outfit", sans-serif',
              letterSpacing: '-1.5px'
            }}>
              {t('welcomeTitle')}
            </h1>

            {/* Subtitle description */}
            <p style={{ color: 'var(--text-secondary-light)', fontSize: '1.1rem', maxWidth: '480px', margin: '0 auto' }}>
              {t('welcomeSubtitle')}
            </p>

            {/* Primary button: MULAI / START */}
            <button className="btn-blue" onClick={handleStartSession} style={{ marginTop: '10px' }}>
              {t('startBtn')} <ArrowRight size={20} />
            </button>

            {/* Bottom Left decoration: Droplet */}
            <div className="water-drop" style={{
              position: 'absolute',
              bottom: '40px',
              left: '40px',
              color: 'var(--color-soft-ocean)',
              opacity: 0.8
            }}>
              <Droplet size={36} fill="currentColor" />
            </div>
          </div>
        )}

        {/* FRAME SELECT SCREEN */}
        {screen === 'frame-select' && (
          <div className="animate-fade-in" style={{
            maxWidth: '1000px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '40px',
            position: 'relative'
          }}>
            {/* Progress Indicator: STEP 2 OF 5 */}
            <div style={{
              position: 'absolute',
              top: '-40px',
              left: '0',
              backgroundColor: 'var(--color-abyss-blue)',
              color: '#FFFFFF',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '700',
              letterSpacing: '0.8px'
            }}>
              STEP 2 OF 5
            </div>

            {/* Title: PILIH FRAME */}
            <div style={{ textAlign: 'center' }}>
              <h2 className="retro-outline">{t('selectFrameTitle')}</h2>
            </div>

            {/* Carousel structure */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              width: '100%'
            }}>
              {/* Left Arrow Button */}
              <button 
                onClick={handlePrevLayout}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: 'var(--color-abyss-blue)'
                }}
              >
                &lt;
              </button>

              {/* Cards list */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                flex: 1,
                maxWidth: '850px'
              }}>
                {FRAME_LAYOUTS.map((layout, index) => {
                  const isSelected = selectedLayoutIndex === index;
                  return (
                    <div 
                      key={layout.id} 
                      onClick={() => setSelectedLayoutIndex(index)}
                      className={`layout-card ${isSelected ? 'selected' : ''}`}
                    >
                      {/* Top Right Standard Badge */}
                      {layout.badge && (
                        <div className="card-badge" style={{
                          backgroundColor: isSelected ? 'var(--color-abyss-blue)' : 'var(--color-soft-ocean)'
                        }}>
                          <Check size={10} />
                          {layout.badge}
                        </div>
                      )}

                      {/* Layout visual thumbnail wireframe */}
                      <div style={{
                        width: '90px',
                        height: '120px',
                        border: isSelected ? '2px dashed var(--color-deep-wave)' : '2px dashed rgba(0,0,0,0.15)',
                        borderRadius: '10px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: '15px'
                      }}>
                        {layout.id === 'classic' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', height: '100%' }}>
                            {[...Array(3)].map((_, i) => <div key={i} style={{ flex: 1, border: '1px solid rgba(0,0,0,0.2)', borderRadius: '2px' }} />)}
                          </div>
                        )}
                        {layout.id === 'grid' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', width: '100%', height: '100%' }}>
                            {[...Array(4)].map((_, i) => <div key={i} style={{ border: '1px solid rgba(0,0,0,0.2)', borderRadius: '2px' }} />)}
                          </div>
                        )}
                        {layout.id === 'single' && (
                          <div style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.2)', borderRadius: '4px' }} />
                        )}
                      </div>

                      {/* Layout Name */}
                      <div style={{ fontWeight: '800', fontSize: '1.1rem', marginTop: '15px', color: 'var(--color-abyss-blue)', textTransform: 'uppercase' }}>
                        {t(layout.nameKey)}
                      </div>

                      {/* Bottom Cut Label / Selected Footer Banner */}
                      {isSelected ? (
                        <div className="card-footer-banner">
                          SELECTED
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary-light)', marginBottom: '4px' }}>
                          {layout.cutsText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Arrow Button */}
              <button 
                onClick={handleNextLayout}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: 'var(--color-abyss-blue)'
                }}
              >
                &gt;
              </button>
            </div>

            {/* Bottom Navigation */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px'
            }}>
              <button className="btn-outline-back" onClick={() => setScreen('welcome')}>
                <ArrowLeft size={16} /> {t('backBtn')}
              </button>
              <button className="btn-blue" onClick={handleConfirmLayout} style={{ borderRadius: '12px', padding: '12px 28px' }}>
                {t('nextBtn')} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMATION PLACEHOLDER (END OF PR #1) */}
        {screen === 'initialized-placeholder' && (
          <div className="light-panel animate-fade-in" style={{
            maxWidth: '650px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <Check size={48} style={{ color: '#00E676', alignSelf: 'center' }} />
            <h2 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-abyss-blue)' }}>{t('nextStepTitle')}</h2>
            <p style={{ color: 'var(--text-secondary-light)', fontSize: '1.1rem' }}>
              {t('nextStepPlaceholder').replace('{slots}', photos.length.toString())}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
              <button className="btn-outline-back" onClick={() => setScreen('frame-select')}>
                <ArrowLeft size={16} /> {t('backBtn')}
              </button>
              <button className="btn-blue" onClick={handleRestart} style={{ borderRadius: '12px', padding: '12px 28px' }}>
                {t('newSessionBtn')}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
