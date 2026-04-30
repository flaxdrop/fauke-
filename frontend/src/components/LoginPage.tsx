import { useEffect, useState } from "react";
import { Clock, LogIn, AlertCircle, Link2, Copy, ExternalLink } from "lucide-react";

import img1 from "../images/1.jpg";
import img2 from "../images/2.jpg";
import img3 from "../images/3.jpg";
import img4 from "../images/4.jpg";
import img5 from "../images/5.jpg";
import img6 from "../images/6.jpg";
import img7 from "../images/7.jpg";
import img8 from "../images/8.jpg";
import img9 from "../images/9.jpg";
import img10 from "../images/10.jpg";
import img11 from "../images/11.jpg";
import img12 from "../images/12.jpg";
import img13 from "../images/13.jpg";

const bgImages = [img1, img2, img3, img4, img5, img6, img7, img8, img9, img10, img11, img12, img13];
const CYCLE_INTERVAL = 30000;
const FADE_DURATION = 2500;

interface LoginPageProps {
    onLogin: (username: string, password: string) => Promise<void>;
    onRequestMagicLink: (username: string) => Promise<{ magicLinkUrl: string; expiresInMinutes: number }>;
}

export default function LoginPage({ onLogin, onRequestMagicLink }: LoginPageProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [magicLoading, setMagicLoading] = useState(false);
    const [magicLinkUrl, setMagicLinkUrl] = useState("");
    const [magicMessage, setMagicMessage] = useState("");
    const [mode, setMode] = useState<"password" | "magic">("password");

    const [layerA, setLayerA] = useState(0);
    const [layerB, setLayerB] = useState(1);
    const [showB, setShowB] = useState(false);

    useEffect(() => {
        bgImages.forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    }, []);

    useEffect(() => {
        let counter = 0;
        const interval = setInterval(() => {
            counter++;
            const nextImg = (counter + 1) % bgImages.length;

            if (counter % 2 === 1) {
                setLayerB(nextImg);
                requestAnimationFrame(() => setShowB(true));
            } else {
                setLayerA(nextImg);
                requestAnimationFrame(() => setShowB(false));
            }
        }, CYCLE_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!username || !password) return;

        setError("");
        setMagicMessage("");
        setLoading(true);

        try {
            await onLogin(username, password);
        } catch (err: any) {
            setError(err?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleRequestMagicLink = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!username) return;

        setError("");
        setMagicMessage("");
        setMagicLinkUrl("");
        setMagicLoading(true);

        try {
            const result = await onRequestMagicLink(username);
            setMagicLinkUrl(result.magicLinkUrl);
            setMagicMessage(`Magic link created. It expires in ${result.expiresInMinutes} minutes.`);
        } catch (err: any) {
            setError(err?.message || "Failed to create magic link");
        } finally {
            setMagicLoading(false);
        }
    };

    return (
        <div className="min-h-full flex items-center justify-center px-4 relative">
            <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
                <div
                    className="absolute inset-0 bg-cover bg-center scale-105"
                    style={{
                        backgroundImage: `url(${bgImages[layerA]})`,
                        opacity: showB ? 0 : 1,
                        filter: "blur(3px)",
                        transition: `opacity ${FADE_DURATION}ms ease-in-out`,
                    }}
                />
                <div
                    className="absolute inset-0 bg-cover bg-center scale-105"
                    style={{
                        backgroundImage: `url(${bgImages[layerB]})`,
                        opacity: showB ? 1 : 0,
                        filter: "blur(3px)",
                        transition: `opacity ${FADE_DURATION}ms ease-in-out`,
                    }}
                />
                <div className="absolute inset-0 bg-black/45" />
            </div>

            <div className="w-full max-w-sm">
                <div className="backdrop-blur-md bg-white/90 dark:bg-gray-900/85 border border-white/20 dark:border-gray-700/60 rounded-2xl shadow-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                            <Clock size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold">Fauke</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Track time with precision</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                            type="button"
                            onClick={() => setMode("password")}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${mode === "password"
                                    ? "bg-brand-500 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                                }`}
                        >
                            Password
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("magic")}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${mode === "magic"
                                    ? "bg-brand-500 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                                }`}
                        >
                            Magic link
                        </button>
                    </div>

                    <form onSubmit={mode === "password" ? handleSubmit : handleRequestMagicLink} className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="username" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                autoComplete="username"
                                autoFocus
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                            />
                        </div>

                        {mode === "password" ? (
                            <>
                                <div>
                                    <label htmlFor="password" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                        Password
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !username || !password}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-brand-500/25"
                                >
                                    {loading ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    ) : (
                                        <>
                                            <LogIn size={16} />
                                            Sign In
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="submit"
                                    disabled={magicLoading || !username}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-brand-500/25"
                                >
                                    {magicLoading ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    ) : (
                                        <>
                                            <Link2 size={16} />
                                            Generate Magic Link
                                        </>
                                    )}
                                </button>

                                {magicMessage && (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
                                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                            <span>{magicMessage}</span>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 break-all text-xs text-gray-700 dark:text-gray-300">
                                            {magicLinkUrl}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(magicLinkUrl);
                                                }}
                                                disabled={!magicLinkUrl}
                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                                            >
                                                <Copy size={14} />
                                                Copy link
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => window.open(magicLinkUrl, "_blank", "noopener,noreferrer")}
                                                disabled={!magicLinkUrl}
                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                                            >
                                                <ExternalLink size={14} />
                                                Open link
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </form>
                </div>

                <p className="text-center text-[11px] text-white/70 mt-6 drop-shadow">
                    Fauke v1.0 - Report once, export everywhere
                </p>
            </div>
        </div>
    );
}
