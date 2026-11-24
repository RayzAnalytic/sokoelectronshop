'use client'

import { useEffect, useRef, useState } from 'react'

export default function SplashScreen() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [visible, setVisible] = useState(true)
    const [fading, setFading] = useState(false)
    const [videoReady, setVideoReady] = useState(false)

    // Force-play, lock muted, prevent pause/stop/unmute, and signal readiness
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        video.muted = true
        video.volume = 0

        const markReady = () => setVideoReady(true)

        // If already buffered enough, mark ready immediately
        if (video.readyState >= 3) {
            markReady()
        } else {
            video.addEventListener('canplay', markReady, { once: true })
            video.addEventListener('playing', markReady, { once: true })
        }

        video.play().catch(() => {
            const onInteract = () => {
                video.muted = true
                video.volume = 0
                video.play().catch(() => { })
                document.removeEventListener('click', onInteract)
                document.removeEventListener('touchstart', onInteract)
                document.removeEventListener('keydown', onInteract)
            }
            document.addEventListener('click', onInteract)
            document.addEventListener('touchstart', onInteract)
            document.addEventListener('keydown', onInteract)
        })

        const preventPause = () => {
            if (video.paused) {
                video.muted = true
                video.volume = 0
                video.play().catch(() => { })
            }
        }
        video.addEventListener('pause', preventPause)
        video.addEventListener('ended', preventPause)

        const forceMute = () => {
            video.muted = true
            video.volume = 0
        }
        video.addEventListener('volumechange', forceMute)

        const preventContext = (e: Event) => e.preventDefault()
        video.addEventListener('contextmenu', preventContext)

        const preventKey = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement === video) {
                e.preventDefault()
            }
        }
        document.addEventListener('keydown', preventKey)

        return () => {
            video.removeEventListener('canplay', markReady)
            video.removeEventListener('playing', markReady)
            video.removeEventListener('pause', preventPause)
            video.removeEventListener('ended', preventPause)
            video.removeEventListener('volumechange', forceMute)
            video.removeEventListener('contextmenu', preventContext)
            document.removeEventListener('keydown', preventKey)
        }
    }, [])

    // Start the hide timers ONLY after the video is ready
    useEffect(() => {
        if (!videoReady) return

        const fadeTimer = setTimeout(() => setFading(true), 3700)
        const hideTimer = setTimeout(() => setVisible(false), 4000)
        return () => {
            clearTimeout(fadeTimer)
            clearTimeout(hideTimer)
        }
    }, [videoReady])

    if (!visible) return null

    return (
        <div
            className={`fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-blue-950 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'
                }`}
        >
            {/* Preload hint so the video starts buffering the moment the page opens */}
            <link rel="preload" as="video" href="/349590_medium.mp4" type="video/mp4" />

            <svg
                viewBox="0 0 1600 600"
                className="w-full max-w-6xl"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <mask
                        id="raze-text-mask-splash"
                        maskUnits="userSpaceOnUse"
                        x="0"
                        y="0"
                        width="1600"
                        height="600"
                    >
                        <rect width="1600" height="600" fill="black" />

                        <text
                            x="800"
                            y="250"
                            textAnchor="middle"
                            fill="white"
                            style={{
                                fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                                fontWeight: 900,
                                fontSize: '190px',
                                letterSpacing: '6px',
                            }}
                        >
                            RAZESTORE
                        </text>

                        <text
                            x="800"
                            y="390"
                            textAnchor="middle"
                            fill="white"
                            style={{
                                fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                                fontWeight: 800,
                                fontSize: '44px',
                                letterSpacing: '8px',
                            }}
                        >
                            ONLINE STORE FOR ELECTRONICS
                        </text>
                    </mask>
                </defs>

                <foreignObject
                    x="0"
                    y="0"
                    width="1600"
                    height="600"
                    mask="url(#raze-text-mask-splash)"
                >
                    <div className="h-full w-full">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="auto"
                            controls={false}
                            disablePictureInPicture
                            disableRemotePlayback
                            className="pointer-events-none h-full w-full object-cover"
                        >
                            <source src="/349590_medium.mp4" type="video/mp4" />
                        </video>
                    </div>
                </foreignObject>
            </svg>

            {videoReady && (
                <div className="absolute bottom-12 flex gap-2">
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-300 [animation-delay:-0.15s]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-200" />
                </div>
            )}
        </div>
    )
}