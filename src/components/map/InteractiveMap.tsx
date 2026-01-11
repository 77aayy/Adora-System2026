/**
 * Interactive Map Component
 * Allows manager to drag a red marker to set hotel location coordinates
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface InteractiveMapProps {
    latitude: number;
    longitude: number;
    onCoordinatesChange: (lat: number, lng: number) => void;
    height?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
    latitude,
    longitude,
    onCoordinatesChange,
    height = '400px'
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    
    // Default coordinates (Riyadh, Saudi Arabia)
    const defaultLat = 24.7136;
    const defaultLng = 46.6753;
    
    const currentLat = latitude || defaultLat;
    const currentLng = longitude || defaultLng;

    useEffect(() => {
        // Load Leaflet CSS and JS dynamically
        const loadLeaflet = async () => {
            if (window.L) {
                setMapLoaded(true);
                return;
            }

            // Load Leaflet CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);

            // Load Leaflet JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            script.crossOrigin = '';
            script.onload = () => {
                setMapLoaded(true);
            };
            document.body.appendChild(script);
        };

        loadLeaflet();
    }, []);

    useEffect(() => {
        if (!mapLoaded || !window.L || !mapContainerRef.current) return;

        // Initialize map if not already initialized
        if (!mapRef.current) {
            const map = window.L.map(mapContainerRef.current, {
                center: [currentLat, currentLng],
                zoom: latitude && longitude ? 15 : 10, // Zoom in more if coordinates are set
                zoomControl: true,
                attributionControl: true
            });

            // Add OpenStreetMap tiles
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            mapRef.current = map;

            // Create custom red marker icon (larger and more visible)
            const redIcon = window.L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
                        width: 36px;
                        height: 36px;
                        background: #ef4444;
                        border: 4px solid white;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        box-shadow: 0 3px 12px rgba(0,0,0,0.4);
                        position: relative;
                        cursor: move;
                        transition: all 0.2s ease;
                    ">
                        <div style="
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) rotate(45deg);
                            width: 14px;
                            height: 14px;
                            background: white;
                            border-radius: 50%;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                        "></div>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36]
            });

            // Add marker
            const marker = window.L.marker(
                [currentLat, currentLng],
                {
                    icon: redIcon,
                    draggable: true,
                    autoPan: true
                }
            ).addTo(map);
            
            // If no coordinates provided, update parent with default
            if (!latitude || !longitude) {
                onCoordinatesChange(currentLat, currentLng);
            }

            markerRef.current = marker;

            // Add popup to marker (will be updated on drag)
            const updatePopup = (lat: number, lng: number) => {
                marker.setPopupContent(`
                    <div style="text-align: center; padding: 8px;">
                        <strong>موقع الفندق</strong><br>
                        <small>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}</small>
                    </div>
                `);
            };
            
            marker.bindPopup(`
                <div style="text-align: center; padding: 8px;">
                    <strong>موقع الفندق</strong><br>
                    <small>Lat: ${currentLat.toFixed(6)}<br>Lng: ${currentLng.toFixed(6)}</small>
                </div>
            `).openPopup();
            
            // Handle marker drag
            marker.on('dragstart', () => {
                setIsDragging(true);
            });

            marker.on('drag', (e: any) => {
                const lat = e.target.getLatLng().lat;
                const lng = e.target.getLatLng().lng;
                updatePopup(lat, lng);
                onCoordinatesChange(lat, lng);
            });

            marker.on('dragend', () => {
                setIsDragging(false);
            });

            // Handle map click to move marker
            map.on('click', (e: any) => {
                const lat = e.latlng.lat;
                const lng = e.latlng.lng;
                marker.setLatLng([lat, lng]);
                map.panTo([lat, lng]); // Smooth pan to clicked location
                updatePopup(lat, lng);
                onCoordinatesChange(lat, lng);
            });
        } else {
            // Update marker position if coordinates changed externally
            if (markerRef.current && latitude && longitude) {
                const currentLat = markerRef.current.getLatLng().lat;
                const currentLng = markerRef.current.getLatLng().lng;
                
                // Only update if coordinates actually changed (avoid infinite loop)
                if (Math.abs(currentLat - latitude) > 0.0001 || Math.abs(currentLng - longitude) > 0.0001) {
                    markerRef.current.setLatLng([latitude, longitude]);
                    mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
                }
            }
        }

        return () => {
            // Cleanup on unmount
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [mapLoaded, currentLat, currentLng, onCoordinatesChange]);

    return (
        <div className="relative">
            <div
                ref={mapContainerRef}
                style={{
                    height,
                    width: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative'
                }}
                className="bg-slate-800"
            >
                {!mapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800/90 z-10">
                        <div className="text-center">
                            <MapPin className="w-8 h-8 text-teal-400 animate-pulse mx-auto mb-2" />
                            <p className="text-sm text-white/60">جاري تحميل الخريطة...</p>
                        </div>
                    </div>
                )}
            </div>
            
            {isDragging && (
                <div className="absolute top-2 right-2 bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium z-20 shadow-lg">
                    اسحب المؤشر لتحديد الموقع
                </div>
            )}
            
            <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                <MapPin className="w-4 h-4" />
                <span>اسحب المؤشر الأحمر أو اضغط على الخريطة لتحديد موقع الفندق</span>
            </div>
        </div>
    );
};

// Extend Window interface for Leaflet
declare global {
    interface Window {
        L: any;
    }
}
