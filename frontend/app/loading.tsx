'use client'

import { useEffect, useRef } from 'react'

export default function Loading() {
    const videoRef = useRef<HTMLVideoElement>(null)

    // Force-play, lock muted, and prevent any pause/stop/unmute interaction.
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        // Lock audio off — always muted, no sound
        video.muted = true
        video.volume = 0

        // Try to play immediately
        video.play().catch(() => {
            // If blocked, retry on any user interaction
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

        // If anything tries to pause or end it, immediately resume
        const preventPause = () => {
            if (video.paused) {
                video.muted = true
                video.volume = 0
                video.play().catch(() => { })
            }
        }
        video.addEventListener('pause', preventPause)
        video.addEventListener('ended', preventPause)

        // If anything tries to change volume or unmute, force it back
        const forceMute = () => {
            video.muted = true
            video.volume = 0
        }
        video.addEventListener('volumechange', forceMute)

        // Block right-click context menu
        const preventContext = (e: Event) => e.preventDefault()
        video.addEventListener('contextmenu', preventContext)

        // Block spacebar (could pause when video focused)
        const preventKey = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement === video) {
                e.preventDefault()
            }
        }
        document.addEventListener('keydown', preventKey)

        return () => {
            video.removeEventListener('pause', preventPause)
            video.removeEventListener('ended', preventPause)
            video.removeEventListener('volumechange', forceMute)
            video.removeEventListener('contextmenu', preventContext)
            document.removeEventListener('keydown', preventKey)
        }
    }, [])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-blue-950">
            {/*
        SVG wraps the video in a <foreignObject> and applies the text mask natively.
        This guarantees the video is clipped to the letter shapes on ALL browsers.
      */}
            <svg
                viewBox="0 0 1600 600"
                className="w-full max-w-6xl"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <mask
                        id="raze-text-mask"
                        maskUnits="userSpaceOnUse"
                        x="0"
                        y="0"
                        width="1600"
                        height="600"
                    >
                        {/* Black = fully hidden */}
                        <rect width="1600" height="600" fill="black" />

                        {/* RAZESTORE — huge, uppercase, black weight */}
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

                        {/* Tagline — uppercase, bold, smaller */}
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

                {/* Video clipped to the letter shapes */}
                <foreignObject
                    x="0"
                    y="0"
                    width="1600"
                    height="600"
                    mask="url(#raze-text-mask)"
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
                            {/* 👇 Replace with your video file in /public */}
                            <source src="/349590_medium.mp4" type="video/mp4" />
                        </video>
                    </div>
                </foreignObject>
            </svg>

            {/* Subtle loading dots */}
            <div className="absolute bottom-12 flex gap-2">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-300 [animation-delay:-0.15s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-200" />
            </div>
        </div>
    )
}