/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  RefreshCw, 
  Sparkles, 
  AlertCircle, 
  Shirt, 
  Scissors, 
  Wand2, 
  Heart, 
  Image as ImageIcon,
  Check, 
  Loader2, 
  CheckCircle2,
  Download,
  Copy,
  Eye,
  Sliders,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Palette,
  Sparkle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { 
  analyzeFace, 
  AnalysisResult, 
  generateMakeoverPreview,
  HAIRSTYLE_PRESETS, 
  HairStyleOption,
  HairFittingParams,
  DEFAULT_FITTING_PARAMS,
  MakeupParams,
  DEFAULT_MAKEUP_TETO,
  DEFAULT_MAKEUP_EGEN,
  MakeoverConfig
} from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PortalHeader from './PortalHeader';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 60, height: 60, x: 20, y: 20 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Dedicated refs: 1 for OS camera shutter, 1 for gallery file picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  // 토탈 메이크오버 스튜디오 상태
  const [studioTab, setStudioTab] = useState<'hair' | 'makeup'>('hair');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('slick_dandy');
  const [makeoverPreview, setMakeoverPreview] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // 두상 맞춤 피팅 파라미터
  const [fittingParams, setFittingParams] = useState<HairFittingParams>({
    offsetY: -10,
    scaleX: 0.76,
    scaleY: 0.76,
    opacity: 0.88,
  });
  const [showFittingSliders, setShowFittingSliders] = useState(false);

  // 가상 메이크업 파라미터 (립, 치크, 피부톤, 눈매 음영)
  const [makeupParams, setMakeupParams] = useState<MakeupParams>(DEFAULT_MAKEUP_TETO);

  // Check if current page is on HTTPS or localhost
  const isSecureOrigin =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 1. Trigger camera: desktop HTTPS uses webcam, mobile/HTTP uses camera shutter
  const handleCameraClick = () => {
    setError(null);
    if (isSecureOrigin && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      startWebcam();
    } else {
      cameraInputRef.current?.click();
    }
  };

  // 2. Trigger album picker
  const handleAlbumClick = () => {
    setError(null);
    albumInputRef.current?.click();
  };

  const startWebcam = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Webcam direct access unavailable, falling back to file picker:', err);
      stopCamera();
      cameraInputRef.current?.click();
    }
  };

  const captureFromWebcam = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCropSrc(dataUrl);
      setImage(null);
      setResult(null);
      stopCamera();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCropSrc(dataUrl);
        setImage(null);
        setResult(null);
        stopCamera();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropComplete = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;

    if (!completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      if (cropSrc) {
        setImage(cropSrc);
        setCropSrc(null);
        handleAnalyze(cropSrc);
      }
      return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const MAX_WIDTH = 800;
    let targetWidth = completedCrop.width * scaleX;
    let targetHeight = completedCrop.height * scaleY;
    if (targetWidth > MAX_WIDTH) {
      targetHeight = Math.round(targetHeight * (MAX_WIDTH / targetWidth));
      targetWidth = MAX_WIDTH;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        img,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        targetWidth,
        targetHeight
      );

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setImage(croppedDataUrl);
      setCropSrc(null);
      handleAnalyze(croppedDataUrl);
    }
  };

  // 분석 실행 및 최적 토탈 메이크오버(헤어+메이크업) 자동 합성
  const handleAnalyze = async (imgToAnalyze?: string) => {
    const targetImage = imgToAnalyze || image;
    if (!targetImage) return;

    setIsAnalyzing(true);
    setError(null);
    setMakeoverPreview(null);
    try {
      const res = await analyzeFace(targetImage);
      setResult(res);

      // 분석 완료 즉시 최적의 헤어스타일 및 최적 메이크업 자동 처방
      const defaultStyle = res.type === 'TETO' ? 'slick_dandy' : 'soft_asche';
      const defaultMakeup = res.type === 'TETO' ? DEFAULT_MAKEUP_TETO : DEFAULT_MAKEUP_EGEN;
      setSelectedStyleId(defaultStyle);
      setMakeupParams(defaultMakeup);

      applyMakeover(targetImage, {
        styleId: defaultStyle,
        fittingParams,
        makeupParams: defaultMakeup,
      });
    } catch (err: any) {
      console.error(err);
      setError('분석 중 오류가 발생했습니다. 다시 촬영하여 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 토탈 메이크오버 렌더링 호출
  const applyMakeover = async (faceImg: string, config: MakeoverConfig) => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const preview = await generateMakeoverPreview(faceImg, config);
      setMakeoverPreview(preview);
    } catch (err: any) {
      console.error(err);
      setRenderError('스타일링 렌더링 중 오류가 발생했습니다.');
    } finally {
      setIsRendering(false);
    }
  };

  // 헤어스타일 변경
  const handleSelectStyle = (styleId: string) => {
    if (!image) return;
    setSelectedStyleId(styleId);
    applyMakeover(image, {
      styleId,
      fittingParams,
      makeupParams,
    });
  };

  // 두상 피팅 넛지 조절
  const handleNudge = (deltaY: number, deltaScale: number) => {
    if (!image) return;
    const newParams: HairFittingParams = {
      ...fittingParams,
      offsetY: Math.max(-30, Math.min(25, fittingParams.offsetY + deltaY)),
      scaleX: Math.max(0.45, Math.min(1.3, Number((fittingParams.scaleX + deltaScale).toFixed(2)))),
      scaleY: Math.max(0.45, Math.min(1.3, Number((fittingParams.scaleY + deltaScale).toFixed(2)))),
    };
    setFittingParams(newParams);
    applyMakeover(image, {
      styleId: selectedStyleId,
      fittingParams: newParams,
      makeupParams,
    });
  };

  const handleFittingParamChange = (key: keyof HairFittingParams, value: number) => {
    if (!image) return;
    const newParams = { ...fittingParams, [key]: value };
    setFittingParams(newParams);
    applyMakeover(image, {
      styleId: selectedStyleId,
      fittingParams: newParams,
      makeupParams,
    });
  };

  // 메이크업 파라미터 조절
  const handleMakeupChange = (key: keyof MakeupParams, value: any) => {
    if (!image) return;
    const newMakeup = { ...makeupParams, [key]: value };
    setMakeupParams(newMakeup);
    applyMakeover(image, {
      styleId: selectedStyleId,
      fittingParams,
      makeupParams: newMakeup,
    });
  };

  // AI 추천값으로 전체 복원
  const handleResetToAIRecommendation = () => {
    if (!image || !result) return;
    const recStyle = result.type === 'TETO' ? 'slick_dandy' : 'soft_asche';
    const recMakeup = result.type === 'TETO' ? DEFAULT_MAKEUP_TETO : DEFAULT_MAKEUP_EGEN;
    const recFitting: HairFittingParams = {
      offsetY: -10,
      scaleX: 0.76,
      scaleY: 0.76,
      opacity: 0.88,
    };
    setSelectedStyleId(recStyle);
    setMakeupParams(recMakeup);
    setFittingParams(recFitting);
    applyMakeover(image, {
      styleId: recStyle,
      fittingParams: recFitting,
      makeupParams: recMakeup,
    });
  };

  const handleCopyPrompt = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleDownload = () => {
    const target = makeoverPreview || image;
    if (!target) return;
    const a = document.createElement('a');
    a.href = target;
    const currentStyle = HAIRSTYLE_PRESETS.find((s) => s.id === selectedStyleId);
    a.download = `AI_토탈메이크오버_${currentStyle?.name || '스타일'}.jpg`;
    a.click();
  };

  const reset = () => {
    stopCamera();
    setImage(null);
    setCropSrc(null);
    setResult(null);
    setError(null);
    setMakeoverPreview(null);
    setRenderError(null);
    setShowOriginal(false);
  };

  const currentStyle = HAIRSTYLE_PRESETS.find((s) => s.id === selectedStyleId) || HAIRSTYLE_PRESETS[0];

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-indigo-100 flex flex-col">
      <PortalHeader appName="실시간 얼굴상 분석" appIcon="👤" category="Face AI" />
      <main className={cn("pt-6 pb-8 px-6 mx-auto transition-all duration-500 relative flex-1 w-full", result ? "max-w-[1680px]" : "max-w-4xl")}>
        {/* Refresh Button - Top Right */}
        <div className="absolute top-6 right-6 z-30">
          <button 
            onClick={() => window.location.reload()}
            className="p-2 bg-white/80 backdrop-blur-md rounded-full border border-gray-100 shadow-sm text-gray-400 hover:text-indigo-600 transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4 mb-3"
          >
            <div className="bg-white backdrop-blur-md px-3 py-1.5 rounded-2xl border border-gray-100 shadow-md flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                <Sparkles className="text-white w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs tracking-tight text-gray-900">FaceType AI</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              실시간 <span className="text-indigo-600">얼굴상 & 메이크오버</span> 분석
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-base md:text-lg mx-auto"
          >
            T존과 페이스라인을 분석하여 테토/에겐 지수를 계산하고, 최적의 가상 헤어스타일과 메이크업 포인트를 실시간으로 피팅합니다.
          </motion.p>
        </div>

        {/* Hidden File Inputs */}
        <input 
          type="file" 
          ref={cameraInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          capture="user" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={albumInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        <div className={cn(
          "grid gap-6 items-start transition-all duration-500",
          result ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2"
        )}>
          {/* Main Action & Photo Section (Column 1) */}
          <section className="space-y-6">
            <div className={cn(
              "relative rounded-3xl overflow-hidden glass transition-all duration-500 border border-gray-200/60 shadow-lg",
              !showCamera && !cropSrc && !image && "p-6 md:p-8 bg-white/80"
            )}>

              {/* Initial Selection: 2 Action Buttons */}
              {!showCamera && !cropSrc && !image && (
                <div className="flex flex-col items-center justify-center text-center space-y-6 py-6">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Camera className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">사진 등록 방법 선택 📸</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      얼굴이 잘 나온 정면 사진을 직접 촬영하거나 앨범에서 선택해주세요.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                    <button
                      type="button"
                      onClick={handleCameraClick}
                      className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      <span>카메라로 즉석 촬영</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAlbumClick}
                      className="w-full py-4 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-2xl font-bold shadow-lg shadow-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <ImageIcon className="w-5 h-5" />
                      <span>사진 앨범/파일 찾기</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100/60 text-xs text-indigo-700 leading-relaxed max-w-md text-left">
                    💡 <strong>안내:</strong> 스마트폰에서는 <strong>'카메라로 즉석 촬영'</strong> 터치 시 즉시 카메라가 켜집니다. 데스크톱에서는 웹캠이 없을 경우 파일 선택창으로 자동 전환됩니다.
                  </div>
                </div>
              )}

              {/* Live Webcam Viewfinder */}
              {showCamera && (
                <div className="relative aspect-[3/4] bg-black">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-64 border-2 border-dashed border-indigo-400/80 rounded-full" />
                  </div>

                  <button 
                    onClick={reset}
                    className="absolute top-6 right-6 p-3 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-black/60 transition-all z-20 border border-white/10"
                    title="취소"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
                    <button 
                      onClick={captureFromWebcam}
                      className="group relative w-20 h-20 rounded-full p-1 bg-white shadow-2xl transition-all scale-105 active:scale-95"
                    >
                      <div className="w-full h-full rounded-full border-4 border-gray-100 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-red-600 transition-all" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Face Crop Selection UI */}
              {cropSrc && !image && (
                <div className="p-5 md:p-6 bg-slate-900 text-white text-center flex flex-col items-center">
                  <div className="mb-4">
                    <span className="text-amber-400 font-bold text-sm">🎯 네모 박스를 조절하여 얼굴 중심을 맞춰주세요!</span>
                    <p className="text-xs text-slate-400 mt-1">이목구비와 이마가 박스 안에 들어가도록 맞춘 후 선택 완료를 눌러주세요.</p>
                  </div>

                  <div className="max-h-[60vh] overflow-hidden rounded-2xl border border-slate-700 bg-black flex items-center justify-center">
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      circularCrop={false}
                    >
                      <img 
                        ref={imgRef} 
                        src={cropSrc} 
                        alt="Crop preview" 
                        className="max-h-[50vh] max-w-full object-contain" 
                      />
                    </ReactCrop>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-5">
                    <button
                      type="button"
                      onClick={handleCropComplete}
                      className="py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>얼굴 선택 & 분석</span>
                    </button>

                    <button
                      type="button"
                      onClick={reset}
                      className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold border border-slate-700 transition-all"
                    >
                      다시 찍기
                    </button>
                  </div>
                </div>
              )}

              {/* Cropped Face Preview */}
              {image && (
                <div className="relative aspect-[3/4] bg-slate-900 overflow-hidden">
                  <img src={image} alt="Selected Face" className="w-full h-full object-cover" />
                  
                  <button 
                    onClick={reset}
                    className="absolute top-4 right-4 p-3 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-black/80 transition-colors z-20 border border-white/10"
                    title="다른 사진 선택"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold">원본 얼굴 사진</span>
                    </div>
                    <button 
                      onClick={reset}
                      className="text-amber-400 underline font-bold hover:text-amber-300"
                    >
                      변경하기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis in Progress */}
            {isAnalyzing && (
              <div className="w-full py-10 flex flex-col items-center justify-center space-y-4 glass rounded-3xl border border-indigo-100">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-6 h-6 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-indigo-600">AI 정밀 분석 & 맞춤 메이크오버 피팅 중...</p>
                  <p className="text-gray-400 text-xs mt-1">T존 입체감과 페이스라인을 대조하여 최적의 스타일을 연출하고 있습니다</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex flex-col items-center gap-3 text-red-600 text-center">
                <AlertCircle className="w-8 h-8 opacity-60" />
                <div className="space-y-1">
                  <p className="font-bold text-sm">분석 중 오류 발생</p>
                  <p className="text-xs opacity-90 leading-relaxed">{error}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => image ? handleAnalyze(image) : reset()}
                    className="px-5 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors shadow-md"
                  >
                    다시 시도
                  </button>
                  <button 
                    onClick={reset}
                    className="px-5 py-2 bg-white text-red-600 border border-red-200 rounded-xl font-bold text-xs hover:bg-red-50 transition-colors"
                  >
                    사진 재선택
                  </button>
                </div>
              </div>
            )}

            {result && !isAnalyzing && (
              <motion.button 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={reset}
                className="w-full py-4 bg-white border border-gray-200 hover:border-indigo-300 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                다른 사진으로 다시 분석하기
              </motion.button>
            )}
          </section>

          {/* Result Section - Analysis & Dual Gauge (Column 2) */}
          <section className={cn("min-h-[400px]", !result && "lg:col-span-1")}>
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  key="result-analysis"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    "p-7 md:p-8 rounded-3xl glass relative overflow-hidden h-full border shadow-lg",
                    result.type === 'TETO' ? "bg-indigo-50/50 border-indigo-100" : "bg-emerald-50/50 border-emerald-100"
                  )}>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-5">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase shadow-sm",
                          result.type === 'TETO' ? "bg-indigo-600 text-white" : "bg-emerald-600 text-white"
                        )}>
                          {result.type === 'TETO' ? '테토상 (Teto)' : '에겐상 (Egen)'}
                        </span>
                        <div className="flex items-center gap-2 bg-white/90 px-3 py-1 rounded-full border border-gray-200/50 shadow-sm">
                          <span className="text-xs font-bold text-gray-400">AI 판별율</span>
                          <span className="font-bold text-gray-900">{result.confidence}%</span>
                        </div>
                      </div>

                      <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
                        당신은 {result.type === 'TETO' ? '시크하고 세련된 테토상' : '부드럽고 친근한 에겐상'}입니다!
                      </h2>

                      {/* 듀얼 지수 게이지 바 */}
                      <div className="my-5 p-4 bg-white/80 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-bold mb-2">
                          <span className="text-indigo-600 flex items-center gap-1">
                            <span>⚡ 테토 지수</span>
                            <span className="text-sm">{result.tetoScore ?? 50}%</span>
                          </span>
                          <span className="text-emerald-600 flex items-center gap-1">
                            <span className="text-sm">{result.egenScore ?? 50}%</span>
                            <span>🌿 에겐 지수</span>
                          </span>
                        </div>
                        <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700"
                            style={{ width: `${result.tetoScore ?? 50}%` }}
                            title={`테토 지수: ${result.tetoScore ?? 50}%`}
                          />
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700"
                            style={{ width: `${result.egenScore ?? 50}%` }}
                            title={`에겐 지수: ${result.egenScore ?? 50}%`}
                          />
                        </div>
                        <div className="text-[11px] text-gray-400 mt-2 text-center">
                          {((result.tetoScore ?? 50) > (result.egenScore ?? 50)) 
                            ? '직선적 T존과 선명한 카리스마 비율이 높습니다.' 
                            : '곡선적인 페이스라인과 부드러운 인상 비율이 높습니다.'}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 leading-relaxed mb-6 text-sm md:text-base">
                        {result.description}
                      </p>

                      <div className="grid grid-cols-1 gap-2.5 mb-2">
                        {result.traits.map((trait, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3.5 bg-white/80 rounded-2xl border border-white/60 shadow-sm">
                            <span className="font-semibold text-gray-500 text-xs md:text-sm">{trait.label}</span>
                            <span className="font-bold text-gray-900 text-xs md:text-sm">{trait.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : !isAnalyzing && (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 min-h-[380px]"
                >
                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
                    <Camera className="text-gray-300 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-500 mb-2">
                    얼굴 사진을 등록해주세요
                  </h3>
                  <p className="text-gray-400 text-sm max-w-[260px] leading-relaxed">
                    왼쪽의 '카메라로 즉석 촬영' 또는 '사진 앨범/파일 찾기' 버튼으로 얼굴을 선택하시면 AI가 즉시 분석해드립니다.
                  </p>

                  <div className="mt-8 pt-6 border-t border-gray-100 w-full">
                    <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                      © 2024 FaceType AI. 본 서비스는 개인화 스타일링을 위한 분석 도구입니다. <br />
                      사진 데이터는 분석용으로만 일회성 활용되며 서버에 영구 보관되지 않습니다.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Result Section - Styling Advice (Column 3) */}
          {result && (
            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="p-6 md:p-8 rounded-3xl glass bg-white/70 h-full relative border border-gray-200/60 shadow-lg">
                <div className="space-y-5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="font-bold text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-indigo-600" />
                      맞춤 스타일링 조언
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3.5">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Shirt className="text-indigo-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-xs mb-1">패션 스타일</h5>
                        <p className="text-gray-600 text-xs leading-relaxed">{result.stylingAdvice.fashion}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                        <Heart className="text-pink-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-xs mb-1">메이크업 포인트</h5>
                        <p className="text-gray-600 text-xs leading-relaxed">{result.stylingAdvice.makeup}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <Scissors className="text-emerald-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-xs mb-1">추천 대표 헤어</h5>
                        <p className="text-gray-600 text-xs leading-relaxed">{result.stylingAdvice.hair}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Sparkles className="text-amber-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-xs mb-1">분위기 연출</h5>
                        <p className="text-gray-600 text-xs leading-relaxed">{result.stylingAdvice.vibe}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Result Section - Virtual Total Makeover Studio (Column 4) */}
          {image && result && (
            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h4 className="font-bold text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  AI 메이크오버 스튜디오
                </h4>
                <button
                  type="button"
                  onClick={handleResetToAIRecommendation}
                  className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all"
                  title="AI가 분석한 최적 추천값으로 복원"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI 추천값 복원</span>
                </button>
              </div>

              {/* 탭 전환기: [헤어 스타일링] vs [메이크업 컨트롤] */}
              <div className="flex bg-gray-200/80 p-1 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStudioTab('hair')}
                  className={cn(
                    "flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5",
                    studioTab === 'hair'
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>헤어 피팅</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('makeup')}
                  className={cn(
                    "flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5",
                    studioTab === 'makeup'
                      ? "bg-white text-pink-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Heart className="w-3.5 h-3.5 text-pink-500" />
                  <span>메이크업 컨트롤</span>
                </button>
              </div>

              {/* TAB 1: 헤어 스타일링 및 두상 조절 */}
              {studioTab === 'hair' && (
                <div className="space-y-3">
                  {/* Hairstyle Selector Chips */}
                  <div className="grid grid-cols-2 gap-2">
                    {HAIRSTYLE_PRESETS.map((preset) => {
                      const isActive = selectedStyleId === preset.id;
                      const isRecommended = preset.category === result.type;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectStyle(preset.id)}
                          className={cn(
                            "p-2.5 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-between",
                            isActive
                              ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                              : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="font-bold text-xs truncate">{preset.name}</span>
                            {isRecommended && (
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase",
                                isActive ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-700"
                              )}>
                                추천
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span 
                              className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0" 
                              style={{ backgroundColor: preset.colorHex }} 
                            />
                            <span className={isActive ? "text-slate-300" : "text-gray-400"}>
                              {preset.colorName}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 두상 맞춤 피팅 조절 툴바 */}
                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                      <span>🎯 두상 맞춤 조절:</span>
                      <button
                        type="button"
                        onClick={() => setShowFittingSliders(!showFittingSliders)}
                        className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>{showFittingSliders ? '슬라이더 닫기' : '정밀 슬라이더'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleNudge(-4, 0)}
                        className="py-1.5 px-2 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                        title="헤어를 위로 올립니다"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>올리기</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudge(4, 0)}
                        className="py-1.5 px-2 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                        title="헤어를 아래로 내립니다"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>내리기</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudge(0, -0.06)}
                        className="py-1.5 px-2 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                        title="헤어 크기를 줄입니다"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                        <span>작게</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudge(0, 0.06)}
                        className="py-1.5 px-2 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                        title="헤어 크기를 키웁니다"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>크게</span>
                      </button>
                    </div>

                    {showFittingSliders && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-2 border-t border-gray-100 space-y-2 text-[10px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">↕️ 이마 높이 ({fittingParams.offsetY}%)</span>
                          <input 
                            type="range" 
                            min="-28" 
                            max="20" 
                            step="2"
                            value={fittingParams.offsetY} 
                            onChange={(e) => handleFittingParamChange('offsetY', Number(e.target.value))}
                            className="w-32 accent-indigo-600"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">↔️ 두상 너비 ({Math.round(fittingParams.scaleX * 100)}%)</span>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="1.25" 
                            step="0.05"
                            value={fittingParams.scaleX} 
                            onChange={(e) => handleFittingParamChange('scaleX', Number(e.target.value))}
                            className="w-32 accent-indigo-600"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: 가상 메이크업 컨트롤 스튜디오 */}
              {studioTab === 'makeup' && (
                <div className="p-3.5 bg-white rounded-2xl border border-gray-200/80 shadow-sm space-y-3.5 text-xs">
                  {/* 1. 립 틴트 컬러 & 농도 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
                      <span>💄 립 틴트 메이크업</span>
                      <span className="text-pink-600">{makeupParams.lipIntensity}%</span>
                    </div>
                    {/* 컬러 버튼 선택 */}
                    <div className="flex gap-1.5">
                      {[
                        { id: 'coral', label: '코랄', color: '#ff6b6b' },
                        { id: 'rose', label: '로즈MLBB', color: '#c23653' },
                        { id: 'red', label: '레드', color: '#dc2626' },
                        { id: 'nude', label: '누디', color: '#c88267' },
                        { id: 'none', label: 'OFF', color: '#cbd5e1' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleMakeupChange('lipColor', c.id)}
                          className={cn(
                            "flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all",
                            makeupParams.lipColor === c.id
                              ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm scale-105"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          )}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                    {makeupParams.lipColor !== 'none' && (
                      <input 
                        type="range" 
                        min="20" 
                        max="100" 
                        step="5"
                        value={makeupParams.lipIntensity}
                        onChange={(e) => handleMakeupChange('lipIntensity', Number(e.target.value))}
                        className="w-full accent-pink-600 mt-1"
                      />
                    )}
                  </div>

                  {/* 2. 치크 블러셔 & 생기 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
                      <span>🌸 치크 블러셔 (생기)</span>
                      <span className="text-amber-600">{makeupParams.blusherIntensity}%</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { id: 'peach', label: '피치', color: '#ff8e72' },
                        { id: 'pink', label: '핑크', color: '#ff75a0' },
                        { id: 'contour', label: '음영', color: '#a56e55' },
                        { id: 'none', label: 'OFF', color: '#cbd5e1' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleMakeupChange('blusherColor', b.id)}
                          className={cn(
                            "flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all",
                            makeupParams.blusherColor === b.id
                              ? "border-amber-500 bg-amber-50 text-amber-800 shadow-sm scale-105"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          )}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                          <span>{b.label}</span>
                        </button>
                      ))}
                    </div>
                    {makeupParams.blusherColor !== 'none' && (
                      <input 
                        type="range" 
                        min="20" 
                        max="100" 
                        step="5"
                        value={makeupParams.blusherIntensity}
                        onChange={(e) => handleMakeupChange('blusherIntensity', Number(e.target.value))}
                        className="w-full accent-amber-600 mt-1"
                      />
                    )}
                  </div>

                  {/* 3. 피부결 정돈 & 톤업 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
                      <span>✨ 피부 톤업 & 스킨 결 정돈</span>
                      <span className="text-indigo-600">{makeupParams.skinTone}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      value={makeupParams.skinTone}
                      onChange={(e) => handleMakeupChange('skinTone', Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  {/* 4. 눈매 음영 깊이 */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
                      <span>👁️ 눈매 아이 컨투어 음영</span>
                      <span className="text-indigo-600">{makeupParams.eyeShading}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      value={makeupParams.eyeShading}
                      onChange={(e) => handleMakeupChange('eyeShading', Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              )}
              
              {/* Image Preview Box with Controls */}
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden glass bg-gray-100 group border border-gray-200/60 shadow-lg">
                {makeoverPreview ? (
                  <>
                    <img 
                      src={showOriginal ? image : makeoverPreview} 
                      alt="Makeover Preview" 
                      className="w-full h-full object-cover transition-opacity duration-200" 
                    />

                    {/* Top Overlay Controls: Before/After & Download */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
                      <button
                        type="button"
                        onMouseDown={() => setShowOriginal(true)}
                        onMouseUp={() => setShowOriginal(false)}
                        onTouchStart={() => setShowOriginal(true)}
                        onTouchEnd={() => setShowOriginal(false)}
                        className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-white rounded-xl text-xs font-bold border border-white/20 shadow-md hover:bg-black/80 flex items-center gap-1.5 active:scale-95 transition-all"
                        title="누르고 있는 동안 원본 사진 표시"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>{showOriginal ? '쌩얼 원본 표시 중' : '쌩얼 비교 (꾹 누르기)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownload}
                        className="p-2 bg-black/60 backdrop-blur-md text-white rounded-xl text-xs font-bold border border-white/20 shadow-md hover:bg-black/80 flex items-center gap-1 active:scale-95 transition-all"
                        title="완성된 스타일링 사진 다운로드"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>

                    {isRendering && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/40 backdrop-blur-sm z-30">
                        <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                        <p className="font-bold text-white text-xs">스타일링 적용 중...</p>
                      </div>
                    )}
                  </>
                ) : isRendering ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                    <p className="font-bold text-indigo-600 text-sm">토탈 메이크오버 렌더링 중...</p>
                    <p className="text-xs text-gray-400 mt-2">헤어와 퍼스널 메이크업을 맞추고 있습니다</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                      <Wand2 className="text-indigo-400 w-8 h-8" />
                    </div>
                    <p className="text-gray-500 text-xs mb-6 leading-relaxed">
                      상단의 컨트롤을 눌러<br />원하는 스타일을 연출해보세요!
                    </p>
                    <button 
                      onClick={() => applyMakeover(image, { styleId: selectedStyleId, fittingParams, makeupParams })}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                      스타일링 적용하기
                    </button>
                  </div>
                )}
                
                {renderError && !isRendering && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-50/90 backdrop-blur-sm">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-red-600 text-xs font-medium">{renderError}</p>
                    <button 
                      onClick={() => applyMakeover(image, { styleId: selectedStyleId, fittingParams, makeupParams })}
                      className="mt-3 text-xs font-bold text-red-600 underline"
                    >
                      다시 시도
                    </button>
                  </div>
                )}
              </div>

              {/* Salon Consultation & Blowout Tip Card */}
              {currentStyle && (
                <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm space-y-2.5 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">💡 {currentStyle.name} 가이드</span>
                      <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                        손질 난이도: {currentStyle.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-500 leading-relaxed text-[11px] mb-1">{currentStyle.desc}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>📏 추천 기장: {currentStyle.hairLength}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-indigo-600 text-[11px]">미용실 방문 시 요청 멘트:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(currentStyle.salonPrompt)}
                        className="text-[10px] text-gray-400 hover:text-indigo-600 flex items-center gap-1 font-semibold"
                      >
                        {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPrompt ? '복사됨!' : '멘트 복사'}</span>
                      </button>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl text-[11px] text-slate-700 leading-relaxed font-mono select-all">
                      "{currentStyle.salonPrompt}"
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
}
