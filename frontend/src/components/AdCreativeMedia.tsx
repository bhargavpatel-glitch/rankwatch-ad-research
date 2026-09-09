import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, FileText } from 'lucide-react';
import { CanonicalAd } from '../types';

interface AdCreativeMediaProps {
  ad: CanonicalAd;
  aspectRatio?: string;
  isDetailedView?: boolean;
}

export const AdCreativeMedia: React.FC<AdCreativeMediaProps> = ({
  ad,
  aspectRatio = 'aspect-[16/10]',
  isDetailedView = false,
}) => {
  const [hasDirectImgError, setHasDirectImgError] = useState(false);
  const [hasProxyImgError, setHasProxyImgError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [useProxyForVideo, setUseProxyForVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const creativeUrl = (ad.creativeUrl || '').trim();
  const creativeType = (ad.creativeType || '').toLowerCase();

  // Media classification
  const isVideo =
    creativeUrl.includes('playlist/vid') ||
    creativeUrl.endsWith('.mp4') ||
    creativeUrl.includes('video') ||
    creativeType.includes('video');

  const isDirectImageCandidate =
    Boolean(creativeUrl) &&
    !isVideo &&
    !creativeUrl.includes('instagram.com') &&
    (creativeUrl.includes('licdn.com') ||
      creativeUrl.endsWith('.jpg') ||
      creativeUrl.endsWith('.png') ||
      creativeUrl.endsWith('.webp') ||
      creativeType.includes('image'));

  const handleVideoHover = (shouldPlay: boolean) => {
    if (isDetailedView) return;
    const video = videoRef.current;
    if (!video || videoError) return;
    if (shouldPlay) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || videoError) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // 1. VIDEO AD (Real video stream / MP4)
  if (isVideo && creativeUrl && !videoError) {
    const videoSrc = useProxyForVideo
      ? `/api/media/proxy?url=${encodeURIComponent(creativeUrl)}`
      : creativeUrl;

    return (
      <div
        className={`relative w-full ${aspectRatio} bg-[#0a0b0e] flex items-center justify-center overflow-hidden group/video`}
        onMouseEnter={() => handleVideoHover(true)}
        onMouseLeave={() => handleVideoHover(false)}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          muted={isMuted}
          playsInline
          loop
          preload="metadata"
          onError={() => {
            if (!useProxyForVideo) {
              setUseProxyForVideo(true);
            } else {
              setVideoError(true);
            }
          }}
          className="w-full h-full object-cover"
        />

        {/* Center Play Button Overlay */}
        {!isPlaying && (
          <div
            onClick={togglePlayPause}
            className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[0.5px] cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-xl group-hover/video:scale-110 group-hover/video:bg-[#10b981] group-hover/video:border-[#2fe593] transition-all duration-300">
              <Play className="w-4 h-4 fill-white translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Bottom Video Controls & Duration Pill (Matches reference: ▶ 0:30 / ▶ 1:12) */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between z-10 opacity-90 group-hover/video:opacity-100 transition-opacity">
          <button
            onClick={toggleMute}
            className="w-6 h-6 rounded-md bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-transform active:scale-90"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-[#2fe593]" />}
          </button>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white shadow-md">
            <Play className="w-2.5 h-2.5 fill-white" />
            <span>0:30</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. IMAGE AD (Direct image creative)
  if (isDirectImageCandidate && !hasProxyImgError) {
    const imgSrc = hasDirectImgError
      ? `/api/media/proxy?url=${encodeURIComponent(creativeUrl)}`
      : creativeUrl;

    return (
      <div className={`relative w-full ${aspectRatio} bg-[#0a0b0e] flex items-center justify-center overflow-hidden group/img`}>
        <img
          src={imgSrc}
          alt={ad.title || ad.brand}
          referrerPolicy="no-referrer"
          onError={() => {
            if (!hasDirectImgError) {
              setHasDirectImgError(true);
            } else {
              setHasProxyImgError(true);
            }
          }}
          loading="lazy"
          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500 ease-out"
        />
      </div>
    );
  }

  // 3. DOCUMENT AD / TEXT AD / PLACEHOLDER (Matches Reference Cards 2 & 4 exactly!)
  // Clean centered dark squircle with green document icon and NO image
  return (
    <div className={`relative w-full ${aspectRatio} bg-[#0a0b0e] flex items-center justify-center overflow-hidden`}>
      {/* Centered Green Document Outline Squircle Placeholder */}
      <div className="w-14 h-14 rounded-2xl bg-[#0f1115] border border-[#222630] flex items-center justify-center shadow-inner group-hover:border-[#2fe593]/40 transition-colors">
        <FileText className="w-7 h-7 text-[#2fe593] stroke-[1.75]" />
      </div>
    </div>
  );
};
