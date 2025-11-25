import React, { useState } from 'react';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import './MappingOverlay.css';

const MappingOverlay = () => {
    const { managerInstancesRef } = useVisualEngineContext();
    
    // Initial state matches Full Screen (Pixi defaults)
    const [corners, setCorners] = useState([
        { x: 0, y: 0 }, // TL
        { x: window.innerWidth, y: 0 }, // TR
        { x: 0, y: window.innerHeight }, // BL
        { x: window.innerWidth, y: window.innerHeight } // BR
    ]);

    const handleDrag = (index, e) => {
        // Prevent glitch on drag end where coords become 0
        if (e.clientX === 0 && e.clientY === 0) return;

        const newX = e.clientX;
        const newY = e.clientY;

        const newCorners = [...corners];
        newCorners[index] = { x: newX, y: newY };
        setCorners(newCorners);

        // Update Pixi
        const engine = managerInstancesRef.current?.engineRef?.current;
        if (engine) {
            engine.updateCorner(index, newX, newY);
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <div className="mapping-overlay" onDragOver={onDragOver}>
            <svg className="mapping-guides">
                <line x1={corners[0].x} y1={corners[0].y} x2={corners[1].x} y2={corners[1].y} stroke="#00f3ff" strokeWidth="2" />
                <line x1={corners[1].x} y1={corners[1].y} x2={corners[3].x} y2={corners[3].y} stroke="#00f3ff" strokeWidth="2" />
                <line x1={corners[3].x} y1={corners[3].y} x2={corners[2].x} y2={corners[2].y} stroke="#00f3ff" strokeWidth="2" />
                <line x1={corners[2].x} y1={corners[2].y} x2={corners[0].x} y2={corners[0].y} stroke="#00f3ff" strokeWidth="2" />
            </svg>
            {corners.map((corner, index) => (
                <div
                    key={index}
                    className="corner-handle"
                    style={{ left: corner.x, top: corner.y }}
                    draggable={true}
                    onDrag={(e) => handleDrag(index, e)}
                    onDragStart={(e) => {
                        // Transparent drag image to hide default ghost
                        const img = new Image();
                        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        e.dataTransfer.setDragImage(img, 0, 0);
                    }}
                />
            ))}
        </div>
    );
};

export default MappingOverlay;