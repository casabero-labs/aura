import React, { useState } from 'react';

const AuraLogo: React.FC = () => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative w-12 h-12 cursor-pointer flex items-center justify-center group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Structural A-Shape */}
            <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[var(--main-color)] stroke-[8] transition-all duration-300">
                <path
                    d="M 20 80 L 50 20 L 80 80 M 35 60 L 65 60"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:stroke-[10]"
                />
                {/* Orbital Node */}
                <circle
                    cx="50" cy="40" r="4"
                    fill="var(--main-color)"
                    className={`transition-all duration-700 ${isHovered ? 'scale-150 opacity-100' : 'opacity-0'}`}
                />
            </svg>

            {/* Internal Data Nodes */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-1 translate-y-4">
                    {[1, 2].map((n) => (
                        <div
                            key={n}
                            className={`w-1 h-1 bg-[var(--main-color)] rounded-full transition-all duration-500 
                ${isHovered ? 'animate-pulse scale-125 opacity-100' : 'opacity-0'}`}
                            style={{ animationDelay: `${n * 150}ms` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AuraLogo;
