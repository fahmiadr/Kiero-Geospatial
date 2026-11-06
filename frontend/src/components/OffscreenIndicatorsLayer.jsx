import React, { useState, useEffect, useRef } from 'react';
import OffscreenIndicator from './OffscreenIndicator';

const PADDING = 40;
const CLUSTER_THRESHOLD_DEGREES = 15;

const OffscreenIndicatorsLayer = ({
    mapInstance,
    pins,
    mapContainerRef,
    onIndicatorClick,
    isStreetViewVisible
}) => {
    const [processedIndicators, setProcessedIndicators] = useState([]);

    useEffect(() => {
        if (!mapInstance || !pins || pins.length === 0 || isStreetViewVisible) {
            setProcessedIndicators([]);
            return;
        }

        const processIndicators = () => {
            const container = mapContainerRef.current;
            if (!container) return;

            const bounds = mapInstance.getBounds();
            const center = mapInstance.getCenter();
            if (!bounds || !center) return;

            const offscreenPins = pins
                .map(pin => {
                    const pinLatLng = new window.google.maps.LatLng(pin.lat, pin.lng);
                    if (bounds.contains(pinLatLng)) return null;
                    let angle = window.google.maps.geometry.spherical.computeHeading(center, pinLatLng);
                    if (angle < 0) angle += 360;
                    return { ...pin, angle };
                })
                .filter(Boolean)
                .sort((a, b) => a.angle - b.angle);

            if (offscreenPins.length === 0) {
                setProcessedIndicators([]);
                return;
            }

            // Simple Clustering
            const clusters = [];
            let currentCluster = [offscreenPins[0]];

            for (let i = 1; i < offscreenPins.length; i++) {
                const pin = offscreenPins[i];
                const prevPin = offscreenPins[i - 1];
                if (pin.angle - prevPin.angle <= CLUSTER_THRESHOLD_DEGREES) {
                    currentCluster.push(pin);
                } else {
                    clusters.push({ pins: currentCluster });
                    currentCluster = [pin];
                }
            }
            clusters.push({ pins: currentCluster });

            // Handle wrap-around clustering (360 -> 0)
            if (clusters.length > 1) {
                const firstCluster = clusters[0];
                const lastCluster = clusters[clusters.length - 1];
                const wrapAroundDiff = (360 - lastCluster.pins[0].angle) + firstCluster.pins[0].angle;
                if (wrapAroundDiff <= CLUSTER_THRESHOLD_DEGREES) {
                    lastCluster.pins.push(...firstCluster.pins);
                    clusters.shift();
                }
            }

            const containerRect = container.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;
            const containerCenter = { x: containerWidth / 2, y: containerHeight / 2 };

            const finalIndicators = clusters.map(cluster => {
                const angles = cluster.pins.map(p => p.angle);
                const sumSin = angles.reduce((sum, angle) => sum + Math.sin(angle * Math.PI / 180), 0);
                const sumCos = angles.reduce((sum, angle) => sum + Math.cos(angle * Math.PI / 180), 0);
                let avgAngleRad = Math.atan2(sumSin, sumCos);
                let avgAngleDeg = avgAngleRad * 180 / Math.PI;
                if (avgAngleDeg < 0) avgAngleDeg += 360;

                const mathAngleRad = ((450 - avgAngleDeg) % 360) * Math.PI / 180;
                const cos = Math.cos(mathAngleRad);
                const sin = Math.sin(mathAngleRad);
                const halfWidth = containerWidth / 2 - PADDING;
                const halfHeight = containerHeight / 2 - PADDING;
                const scaleX = Math.abs(cos) > 1e-9 ? halfWidth / Math.abs(cos) : Infinity;
                const scaleY = Math.abs(sin) > 1e-9 ? halfHeight / Math.abs(sin) : Infinity;
                const scale = Math.min(scaleX, scaleY);
                const intersectX = scale * cos;
                const intersectY = scale * sin;
                const x = containerCenter.x + intersectX;
                const y = containerCenter.y - intersectY;

                return {
                    id: cluster.pins.map(p => p.id).join('-'),
                    pins: cluster.pins,
                    count: cluster.pins.length,
                    rotation: avgAngleDeg + 180,
                    top: y,
                    left: x,
                };
            });

            setProcessedIndicators(finalIndicators);
        };

        const idleListener = mapInstance.addListener('idle', processIndicators);
        const resizeObserver = new ResizeObserver(processIndicators);
        const currentMapContainer = mapContainerRef.current;
        if (currentMapContainer) {
            resizeObserver.observe(currentMapContainer);
        }
        processIndicators();

        return () => {
            idleListener.remove();
            if (currentMapContainer) {
                resizeObserver.unobserve(currentMapContainer);
            }
        };
    }, [mapInstance, pins, mapContainerRef, isStreetViewVisible]);

    if (isStreetViewVisible) return null;

    return (
        <>
            {processedIndicators.map(indicator => (
                <OffscreenIndicator
                    key={indicator.id}
                    top={indicator.top}
                    left={indicator.left}
                    rotation={indicator.rotation}
                    count={indicator.count}
                    onClick={() => onIndicatorClick(indicator)}
                />
            ))}
        </>
    );
};

export default React.memo(OffscreenIndicatorsLayer);
