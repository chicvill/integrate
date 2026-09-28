/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Sparkles, ChevronRight, Info, AlertCircle, Shirt, Scissors, Wand2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFace, AnalysisResult, generateHairPreview } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import PortalHeader from './PortalHeader';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isCentered, setIsCentered] = useState(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hairPreview, setHairPreview] = useState<string | null>(null);
  const [isGeneratingHair, setIsGeneratingHair] = useState(false);
  const [hairError, setHairError] = useState<string | null>(null);

  // Assign stream to video element when both are ready
  useEffect(() => {
    if (showCamera && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => {
          console.error("Video play failed:", e);
          setError('비디오 재생을 시작할 수 없습니다.');
        });
      };
    }
  }, [showCamera, stream]);

  // Start camera on mount if no image
  useEffect(() => {
    if (!image && !result && !showCamera) {
      startCamera();
    }
    return () => stopCamera();
  }, []);

  // Detection loop for nose/face centering
  useEffect(() => {
    let animationFrameId: number;
    
    const detect = async () => {
      if (showCamera && videoRef.current && videoRef.current.readyState === 4) {
        if ('FaceDetector' in window) {
          try {
            const faceDetector = new (window as any).FaceDetector();
            const faces = await faceDetector.detect(videoRef.current);
            
            if (faces.length > 0) {
              const face = faces[0];
              const { x, y, width, height } = face.boundingBox;
              const centerX = x + width / 2;
              const centerY = y + height / 2;
              
              const videoWidth = videoRef.current.videoWidth;
              const videoHeight = videoRef.current.videoHeight;
              
              // Center box: 30% of the screen
              const boxSize = Math.min(videoWidth, videoHeight) * 0.3;
              const left = (videoWidth - boxSize) / 2;
              const top = (videoHeight - boxSize) / 2;
              const right = left + boxSize;
              const bottom = top + boxSize;
              
              const centered = centerX > left && centerX < right &&
                              centerY > top && centerY < bottom;
              
              setIsCentered(centered);
            } else {
              setIsCentered(false);
            }
          } catch (e) {
            // Silently fail or fallback to true if detection fails to avoid blocking the user
            setIsCentered(true);
          }
        } else {
          // If FaceDetector is not supported, we'll allow capture by default
          setIsCentered(true);
        }
      }
      animationFrameId = requestAnimationFrame(detect);
    };
    
    if (showCamera) {
      detect();
    } else {
      setIsCentered(false);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showCamera]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 카메라 기능을 지원하지 않거나, 보안 연결(HTTPS)이 필요합니다.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      setStream(mediaStream);
      setShowCamera(true);
    } catch (err: any) {
      console.error('Camera Error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('카메라를 찾을 수 없습니다. 장치에 카메라가 연결되어 있는지 확인해주세요.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('카메라가 이미 다른 프로그램에서 사용 중일 수 있습니다.');
      } else {
        setError(`카메라 오류: ${err.message || '알 수 없는 오류가 발생했습니다.'}`);
      }
    }
  };

  const handleAnalyze = async (imgToAnalyze?: string) => {
    const targetImage = imgToAnalyze || image;
    if (!targetImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await analyzeFace(targetImage);
      setResult(res);
    } catch (err) {
      console.error(err);
      setError('분석 중 오류가 발생했습니다. 다시 촬영하여 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const handleGenerateHair = async () => {
    if (!image || !result) return;
    setIsGeneratingHair(true);
    setHairError(null);
    try {
      const preview = await generateHairPreview(image, result.stylingAdvice.hair);
      setHairPreview(preview);
    } catch (err: any) {
      console.error(err);
      setHairError('헤어 스타일 이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingHair(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImage(dataUrl);
        stopCamera();
        handleAnalyze(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setHairPreview(null);
    setHairError(null);
    startCamera();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-indigo-100 flex flex-col">
      <PortalHeader appName="실시간 얼굴상 분석" appIcon="👤" category="Face AI" />
      <main className={cn("pt-6 pb-8 px-6 mx-auto transition-all duration-500 relative flex-1 w-full", result ? "max-w-[1600px]" : "max-w-4xl")}>
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

        <div className="text-center mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4 mb-4"
          >
            {/* Logo Watermark - Now in Title */}
            <div className="bg-white backdrop-blur-md px-3 py-1.5 rounded-2xl border border-gray-100 shadow-md flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                <Sparkles className="text-white w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs tracking-tight text-gray-900">FaceType AI</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              실시간 <span className="text-indigo-600">얼굴상</span> 분석
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-lg mx-auto whitespace-nowrap"
          >
            카메라로 당신의 얼굴을 비추어 테토상인지 에겐상인지 확인하고 맞춤 스타일링 조언을 받아보세요.
          </motion.p>
        </div>

        <div className={cn(
          "grid gap-6 items-start transition-all duration-500",
          result ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2"
        )}>
          {/* Camera Section */}
          <section className="space-y-6">
            <div className={cn(
              "relative aspect-[3/4] rounded-3xl overflow-hidden glass transition-all duration-500",
              !showCamera && !image && "bg-gray-900"
            )}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
              {showCamera ? (
                <div className="absolute inset-0 bg-black">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  
                  {/* Camera Switch/Reset Button */}
                  <button 
                    onClick={reset}
                    className="absolute top-6 right-6 p-3 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-black/60 transition-all z-20 border border-white/10"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
                    <button 
                      onClick={capturePhoto}
                      disabled={!isCentered}
                      className={cn(
                        "group relative w-20 h-20 rounded-full p-1 shadow-2xl transition-all scale-105",
                        isCentered ? "bg-white" : "bg-gray-200 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-full h-full rounded-full border-4 border-gray-100 flex items-center justify-center">
                        <div className={cn(
                          "w-14 h-14 rounded-full transition-all group-active:scale-90",
                          isCentered ? "bg-red-600" : "bg-gray-400"
                        )} />
                      </div>
                    </button>
                  </div>
                </div>
              ) : image ? (
                <div className="relative h-full">
                  <img src={image} alt="Captured" className="w-full h-full object-cover scale-x-[-1]" />
                  <div className="absolute inset-0 bg-black/10" />
                  <button 
                    onClick={reset}
                    className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors z-20"
                  >
                    <RefreshCw className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-gray-900">
                  <Camera className="w-16 h-16 mb-6 text-indigo-400 animate-pulse" />
                  <h3 className="text-xl font-bold mb-2">카메라가 꺼져 있습니다</h3>
                  <p className="text-sm opacity-70 mb-8">실시간 분석을 위해 카메라를 켜주세요</p>
                  <button 
                    onClick={startCamera}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20"
                  >
                    카메라 시작하기
                  </button>
                  <button 
                    onClick={triggerFileUpload}
                    className="mt-4 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2"
                  >
                    <Info className="w-4 h-4" />
                    또는 사진 업로드하기
                  </button>
                </div>
              )}
            </div>

            {/* Action Button Section - Moved to right column */}
            {result && (
              <motion.button 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={reset}
                className="w-full py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-5 h-5" />
                다시 촬영하기
              </motion.button>
            )}

            {isAnalyzing && (
              <div className="w-full py-12 flex flex-col items-center justify-center space-y-4 glass rounded-3xl">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-6 h-6 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-indigo-600">AI 정밀 분석 중...</p>
                  <p className="text-gray-400 text-sm">얼굴형과 이목구비를 대조하고 있습니다</p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex flex-col items-center gap-4 text-red-600 text-center">
                <AlertCircle className="w-10 h-10 opacity-50" />
                <div className="space-y-1">
                  <p className="font-bold">카메라 연결 실패</p>
                  <p className="text-sm opacity-80 leading-relaxed">{error}</p>
                  <p className="text-[10px] opacity-60 mt-2">브라우저 주소창의 카메라 아이콘을 눌러 권한을 허용해주세요.</p>
                </div>
                <button 
                  onClick={startCamera}
                  className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  다시 시도하기
                </button>
                <button 
                  onClick={triggerFileUpload}
                  className="text-sm font-bold text-red-400 hover:text-red-500 underline"
                >
                  사진 직접 업로드하기
                </button>
              </div>
            )}
          </section>

          {/* Result Section - Analysis */}
          <section className={cn("min-h-[500px]", !result && "lg:col-span-1")}>
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
                    "p-8 rounded-3xl glass relative overflow-hidden h-full",
                    result.type === 'TETO' ? "bg-indigo-50/50" : "bg-emerald-50/50"
                  )}>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase",
                          result.type === 'TETO' ? "bg-indigo-600 text-white" : "bg-emerald-600 text-white"
                        )}>
                          {result.type === 'TETO' ? '테토상 (Teto)' : '에겐상 (Egen)'}
                        </span>
                        <div className="flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full border border-white/50 shadow-sm">
                          <span className="text-xs font-bold text-gray-400">AI 확신도</span>
                          <span className="font-bold text-gray-900">{result.confidence}%</span>
                        </div>
                      </div>

                      <h2 className="text-3xl font-bold mb-4 tracking-tight">
                        당신은 {result.type === 'TETO' ? '시크하고 세련된 테토상' : '부드럽고 친근한 에겐상'}입니다!
                      </h2>
                      
                      <p className="text-gray-600 leading-relaxed mb-8 text-lg">
                        {result.description}
                      </p>

                      <div className="grid grid-cols-1 gap-3 mb-8">
                        {result.traits.map((trait, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-white/50 shadow-sm">
                            <span className="font-semibold text-gray-500 text-sm">{trait.label}</span>
                            <span className="font-bold text-gray-900">{trait.value}</span>
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
                  className="h-full flex flex-col items-center p-8 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50"
                >


                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
                    <Camera className="text-gray-300 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-400 mb-2">
                    카메라로 얼굴을 촬영해주세요
                  </h3>
                  
                  {image && !isAnalyzing && (
                    <div className="w-full flex flex-col items-center gap-6 my-4">
                      <button 
                        onClick={() => handleAnalyze()}
                        className="w-full max-w-xs py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(79,70,229,0.4)]"
                      >
                        <Sparkles className="w-6 h-6 animate-pulse" />
                        분석하기
                      </button>
                      
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="flex items-center gap-2 text-indigo-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-bold text-sm">사진 촬영 완료!</span>
                        </div>
                        <p className="text-[11px] text-gray-400">위 버튼을 눌러 분석을 시작하세요</p>
                      </motion.div>
                    </div>
                  )}

                  {!image && (
                    <p className="text-gray-400 text-sm max-w-[240px] mb-6">
                      촬영 즉시 AI가 당신의 얼굴상을 분석해드립니다.
                    </p>
                  )}

                  {/* Footer Info inside the card */}
                  <div className="mt-auto pt-6 border-t border-gray-100 w-full">
                    <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                      © 2024 FaceType AI. 본 서비스는 재미를 위한 분석 도구입니다. <br />
                      실시간 영상은 분석용으로만 사용되며 저장되지 않습니다.
                    </p>
                  </div>

                  {/* 분석 대기 중 Indicator moved here */}
                  {showCamera && (
                    <div className="w-full mt-6 py-4 rounded-2xl font-bold text-lg bg-gray-50 border border-gray-200 text-gray-400 flex items-center justify-center gap-2 opacity-50">
                      <Sparkles className="w-6 h-6" />
                      분석 대기 중...
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Result Section - Styling Advice */}
          {result && (
            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="p-8 rounded-3xl glass bg-white/50 h-full relative">
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      맞춤 스타일링 조언
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Shirt className="text-indigo-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-sm mb-1">패션 스타일</h5>
                        <p className="text-gray-600 text-sm leading-relaxed">{result.stylingAdvice.fashion}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                        <Heart className="text-pink-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-sm mb-1">메이크업 포인트</h5>
                        <p className="text-gray-600 text-sm leading-relaxed">{result.stylingAdvice.makeup}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <Scissors className="text-emerald-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-sm mb-1">추천 헤어</h5>
                        <p className="text-gray-600 text-sm leading-relaxed">{result.stylingAdvice.hair}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Sparkles className="text-amber-600 w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 text-sm mb-1">분위기 연출</h5>
                        <p className="text-gray-600 text-sm leading-relaxed">{result.stylingAdvice.vibe}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Result Section - Hair Preview (Column 4) */}
          {image && result && (
            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-1">
                <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  헤어 스타일 미리보기
                </h4>
              </div>
              
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden glass bg-gray-100 group">
                {hairPreview ? (
                  <img src={hairPreview} alt="Hair Preview" className="w-full h-full object-cover" />
                ) : isGeneratingHair ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                    <p className="font-bold text-indigo-600">AI 헤어 디자이너가 작업 중...</p>
                    <p className="text-xs text-gray-400 mt-2">약 10~20초 정도 소요될 수 있습니다</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                      <Wand2 className="text-indigo-400 w-8 h-8" />
                    </div>
                    <p className="text-gray-500 text-sm mb-6">
                      추천 헤어스타일이 적용된<br />모습을 미리 확인해보세요!
                    </p>
                    <button 
                      onClick={handleGenerateHair}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                      미리보기 생성하기
                    </button>
                  </div>
                )}
                
                {hairError && !isGeneratingHair && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-50/90 backdrop-blur-sm">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-red-600 text-sm font-medium">{hairError}</p>
                    <button 
                      onClick={handleGenerateHair}
                      className="mt-4 text-xs font-bold text-red-600 underline"
                    >
                      다시 시도
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Info moved to Column 4 */}
              <div className="mt-auto pt-6 border-t border-gray-100 w-full">
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                  © 2024 FaceType AI. 본 서비스는 재미를 위한 분석 도구입니다. <br />
                  실시간 영상은 분석용으로만 사용되며 저장되지 않습니다.
                </p>
              </div>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
}
