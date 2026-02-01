import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShapeType } from '../../types';

interface ShapeRendererProps {
  type: ShapeType; // Start Shape
  color: string;
  size: number;
  
  targetType: ShapeType; // End Shape
  targetColor: string;
  
  conformity: number; // 0 to 1 (Interpolation factor)
  className?: string;
}

// --- 4-Point Polygon Interpolation Math ---
// We define every shape as a sequence of 4 Cubic Bezier curves.
// Format: [M.x, M.y,  C1.cp1x, C1.cp1y, C1.cp2x, C1.cp2y, C1.x, C1.y,  C2..., C3..., C4...]
// Total 2 + 4 * 6 = 26 numbers per shape.
// Viewport is 0-100. Center is 50,50.

const SHAPE_DATA: Record<ShapeType, number[]> = {
    // Circle: Uses kappa = 0.55228 for perfect circular approximation
    [ShapeType.CIRCLE]: [
        50, 0,
        77.6, 0, 100, 22.4, 100, 50,
        100, 77.6, 77.6, 100, 50, 100,
        22.4, 100, 0, 77.6, 0, 50,
        0, 22.4, 22.4, 0, 50, 0
    ],
    // Square: Sharp corners using overlapping control points at vertices
    [ShapeType.SQUARE]: [
        50, 0,
        100, 0, 100, 0, 100, 50,    // Top-Mid -> Top-Right -> Right-Mid
        100, 100, 100, 100, 50, 100, // Right-Mid -> Bottom-Right -> Bottom-Mid
        0, 100, 0, 100, 0, 50,       // Bottom-Mid -> Bottom-Left -> Left-Mid
        0, 0, 0, 0, 50, 0            // Left-Mid -> Top-Left -> Top-Mid
    ],
    // Triangle: Split bottom edge to create 4 segments
    [ShapeType.TRIANGLE]: [
        50, 0,
        62.5, 25, 75, 50, 75, 50,    // Top -> Right Edge Mid (Visual approx)
        100, 100, 100, 100, 50, 100, // Right Edge -> Corner -> Bottom Mid
        0, 100, 0, 100, 25, 50,      // Bottom Mid -> Corner -> Left Edge Mid
        25, 50, 37.5, 25, 50, 0      // Left Edge Mid -> Top
    ],
    // Hexagon: Approximated with 4 segments (bulging diamond/square hybrid)
    [ShapeType.HEXAGON]: [
        50, 0,
        95, 5, 100, 25, 100, 50,
        100, 75, 95, 95, 50, 100,
        5, 95, 0, 75, 0, 50,
        0, 25, 5, 5, 50, 0
    ],
    // Diamond: Straight lines between midpoints
    [ShapeType.DIAMOND]: [
        50, 0,
        66, 16, 84, 34, 100, 50,
        84, 66, 66, 84, 50, 100,
        34, 84, 16, 66, 0, 50,
        16, 34, 34, 16, 50, 0
    ],
    // Star: Not perfect, but morphable
    [ShapeType.STAR]: [
        50, 0,
        60, 40, 95, 40, 70, 60,
        80, 90, 50, 75, 50, 75,
        20, 90, 30, 60, 30, 60,
        5, 40, 40, 40, 50, 0
    ]
};

// Linear Interpolation helper
const lerp = (start: number, end: number, t: number) => {
    return start + (end - start) * t;
};

// Color Parser & Interpolation
const parseColor = (color: string) => {
    // Handle hex
    const hexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexResult) {
        return [parseInt(hexResult[1], 16), parseInt(hexResult[2], 16), parseInt(hexResult[3], 16)];
    }
    // Handle rgb
    const rgbResult = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color);
    if (rgbResult) {
        return [parseInt(rgbResult[1], 10), parseInt(rgbResult[2], 10), parseInt(rgbResult[3], 10)];
    }
    // Fallback to black if parsing fails
    return [0, 0, 0];
};

const lerpColor = (c1: string, c2: string, t: number) => {
    const [r1, g1, b1] = parseColor(c1);
    const [r2, g2, b2] = parseColor(c2);
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));
    return `rgb(${r}, ${g}, ${b})`;
};

export const ShapeRenderer: React.FC<ShapeRendererProps> = ({ 
  type, 
  color, 
  size,
  targetType,
  targetColor,
  conformity,
  className 
}) => {
  
  // 1. Calculate Interpolated Path Data
  const d = useMemo(() => {
      const startData = SHAPE_DATA[type] || SHAPE_DATA[ShapeType.SQUARE];
      const endData = SHAPE_DATA[targetType] || SHAPE_DATA[ShapeType.SQUARE];
      
      const current = startData.map((val, i) => lerp(val, endData[i], conformity));
      
      // Construct SVG Path String
      // M x y
      // C cp1x cp1y cp2x cp2y x y (Repeated 4 times)
      return `M ${current[0]} ${current[1]} ` +
             `C ${current[2]} ${current[3]} ${current[4]} ${current[5]} ${current[6]} ${current[7]} ` +
             `C ${current[8]} ${current[9]} ${current[10]} ${current[11]} ${current[12]} ${current[13]} ` +
             `C ${current[14]} ${current[15]} ${current[16]} ${current[17]} ${current[18]} ${current[19]} ` +
             `C ${current[20]} ${current[21]} ${current[22]} ${current[23]} ${current[24]} ${current[25]} ` +
             `Z`;
  }, [type, targetType, conformity]);

  // 2. Calculate Interpolated Color
  const currentColor = useMemo(() => lerpColor(color, targetColor, conformity), [color, targetColor, conformity]);

  // Unique IDs for gradients
  const idSuffix = React.useId(); 
  const gradientId = `grad-${idSuffix}`;
  const filterId = `glow-${idSuffix}`;

  return (
    <div style={{ width: size, height: size }} className={`relative ${className}`}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={currentColor} style={{ stopOpacity: 1 }} />
                    <stop offset="60%" stopColor={currentColor} style={{ stopOpacity: 0.8 }} />
                    <stop offset="100%" stopColor="#000" style={{ stopOpacity: 0.4 }} />
                </linearGradient>
                <filter id={filterId}>
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                </filter>
            </defs>

            <path 
                d={d} 
                fill={`url(#${gradientId})`} 
                stroke={currentColor}
                strokeWidth="1.5"
                strokeOpacity="0.8"
                filter={`url(#${filterId})`}
                vectorEffect="non-scaling-stroke"
            />
            
            {/* Optional Wireframe overlay for 'tech' feel */}
            <path 
                d={d} 
                fill="none" 
                stroke="white"
                strokeWidth="0.5"
                strokeOpacity="0.1"
            />
        </svg>
    </div>
  );
};
