import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Haversine formula to compute distance in kilometers
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

export default function TripLocationMap({ trip, currentUser, onRefreshTrip }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Destinations & Member Locations
  const [destinations, setDestinations] = useState([]);
  const [memberLocations, setMemberLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Location Sharing State
  const [isSharingLive, setIsSharingLive] = useState(false);
  const [myCoords, setMyCoords] = useState(null);
  const [myStatusMessage, setMyStatusMessage] = useState('With the group 🎒');
  const [sharingIntervalId, setSharingIntervalId] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  // Add Destination Form State
  const [showAddDestForm, setShowAddDestForm] = useState(false);
  const [destSearchQuery, setDestSearchQuery] = useState('');
  const [destSearchResults, setDestSearchResults] = useState([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [newDest, setNewDest] = useState({
    name: '',
    category: 'Attraction',
    latitude: '',
    longitude: '',
    address: '',
    notes: '',
    plannedDate: ''
  });

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const CATEGORIES = [
    { id: 'Attraction', label: 'Attraction / Sightseeing', icon: '📍', color: '#aa3bff' },
    { id: 'Hotel', label: 'Hotel / Accommodation', icon: '🏨', color: '#337BFF' },
    { id: 'Food', label: 'Restaurant / Food', icon: '🍴', color: '#FF8E33' },
    { id: 'Transit', label: 'Airport / Station / Transit', icon: '✈️', color: '#33FFAF' },
    { id: 'MeetingPoint', label: 'Meeting Point', icon: '🚩', color: '#28a745' },
    { id: 'Activity', label: 'Activity / Event', icon: '🎡', color: '#FF33F6' },
    { id: 'Other', label: 'Other Place', icon: '📌', color: '#6c757d' }
  ];

  // Fetch Destinations & Member Locations
  const fetchMapData = useCallback(async () => {
    if (!trip?.id) return;
    try {
      const [destRes, membersRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/locations/trip/${trip.id}/destinations`, { headers }),
        axios.get(`${apiBaseUrl}/api/locations/trip/${trip.id}/members`, { headers })
      ]);
      setDestinations(destRes.data);
      setMemberLocations(membersRes.data);

      // Check if current user is actively sharing
      const myLoc = membersRes.data.find(m => m.userId === currentUser.id);
      if (myLoc && myLoc.isSharing) {
        setIsSharingLive(true);
        if (myLoc.statusMessage) setMyStatusMessage(myLoc.statusMessage);
        setMyCoords({ lat: myLoc.latitude, lng: myLoc.longitude });
      }
    } catch (err) {
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  }, [trip?.id, currentUser?.id, apiBaseUrl]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Periodic poll for member locations every 15s
  useEffect(() => {
    if (!trip?.id) return;
    const interval = setInterval(fetchMapData, 15000);
    return () => clearInterval(interval);
  }, [trip?.id, fetchMapData]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Map already initialized

    // Default center: India or global, or trip destination if geocodable
    const defaultCenter = [22.5726, 88.3639]; // fallback
    const defaultZoom = 12;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: true
    });

    // Add OpenStreetMap TileLayer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Layer group for dynamic markers
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Click on map to auto-fill coordinates in Add Destination form
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setNewDest(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
      }));
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers on Destinations or MemberLocations change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const allLatLngs = [];

    // 1. Render Trip Destinations
    destinations.forEach(dest => {
      if (!dest.latitude || !dest.longitude) return;
      const catObj = CATEGORIES.find(c => c.id === dest.category) || CATEGORIES[0];
      const latlng = [dest.latitude, dest.longitude];
      allLatLngs.push(latlng);

      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="
            background: ${catObj.color};
            color: white;
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid white;
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-size: 16px;">${catObj.icon}</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
      });

      const marker = L.marker(latlng, { icon: destIcon }).addTo(markersLayer);

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="font-size: 18px;">${catObj.icon}</span>
            <strong style="font-size: 15px; color: #111;">${dest.name}</strong>
          </div>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; background: ${catObj.color}22; color: ${catObj.color}; font-size: 11px; font-weight: bold; margin-bottom: 8px;">
            ${catObj.label}
          </span>
          ${dest.address ? `<p style="margin: 4px 0; color: #555;">📍 ${dest.address}</p>` : ''}
          ${dest.notes ? `<p style="margin: 4px 0; color: #444; font-style: italic;">📝 "${dest.notes}"</p>` : ''}
          ${dest.plannedDate ? `<p style="margin: 4px 0; color: #666; font-size: 11px;">📅 ${new Date(dest.plannedDate).toLocaleDateString()}</p>` : ''}
          <div style="margin-top: 10px; display: flex; gap: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}" target="_blank" rel="noopener noreferrer" style="
              display: inline-block;
              padding: 5px 10px;
              background: #28a745;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-size: 11px;
              font-weight: bold;
            ">Navigate / Directions ↗</a>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);
    });

    // 2. Render Trip Friends / Member Locations
    memberLocations.forEach(mLoc => {
      if (!mLoc.isSharing || !mLoc.latitude || !mLoc.longitude) return;
      const latlng = [mLoc.latitude, mLoc.longitude];
      allLatLngs.push(latlng);

      const isMe = mLoc.userId === currentUser.id;
      const userInitial = mLoc.user?.name ? mLoc.user.name.charAt(0).toUpperCase() : '?';
      const userColor = isMe ? '#aa3bff' : '#00b4d8';
      const distanceToMe = myCoords ? getDistanceFromLatLonInKm(myCoords.lat, myCoords.lng, mLoc.latitude, mLoc.longitude) : null;

      const memberIcon = L.divIcon({
        className: 'custom-member-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: ${userColor};
              border: 3px solid white;
              box-shadow: 0 4px 14px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 800;
              font-size: 16px;
              position: relative;
            ">
              ${mLoc.user?.avatarUrl ? `<img src="${mLoc.user.avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />` : userInitial}
              <span style="
                position: absolute;
                bottom: 0px;
                right: 0px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: ${mLoc.isOnline ? '#10b981' : '#ffb300'};
                border: 2px solid white;
              "></span>
            </div>
            <div style="
              background: rgba(0,0,0,0.75);
              color: white;
              font-size: 10px;
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 8px;
              margin-top: 3px;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              ${isMe ? 'You' : mLoc.user?.name}
            </div>
          </div>
        `,
        iconSize: [44, 60],
        iconAnchor: [22, 44],
        popupAnchor: [0, -44]
      });

      const marker = L.marker(latlng, { icon: memberIcon }).addTo(markersLayer);

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 13px; min-width: 210px; line-height: 1.4;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${userColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">
              ${userInitial}
            </div>
            <div>
              <strong style="font-size: 14px; color: #111;">${mLoc.user?.name}</strong>
              <div style="font-size: 11px; color: ${mLoc.isOnline ? '#10b981' : '#ffb300'}; font-weight: bold;">
                ● ${mLoc.isOnline ? 'Online now' : 'Active recently'} (${mLoc.freshness})
              </div>
            </div>
          </div>
          ${mLoc.statusMessage ? `<p style="margin: 6px 0; background: #f4f3ec; padding: 6px 8px; border-radius: 6px; font-style: italic; color: #333;">"${mLoc.statusMessage}"</p>` : ''}
          ${distanceToMe && !isMe ? `<p style="margin: 4px 0; color: #aa3bff; font-weight: bold;">📏 ${distanceToMe} km from you</p>` : ''}
          <div style="margin-top: 10px; display: flex; gap: 6px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${mLoc.latitude},${mLoc.longitude}" target="_blank" rel="noopener noreferrer" style="
              display: inline-block;
              padding: 5px 10px;
              background: #aa3bff;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-size: 11px;
              font-weight: bold;
            ">Navigate to Friend 🏃</a>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);
    });

    // Fit bounds if we have markers
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [destinations, memberLocations, myCoords, currentUser.id]);

  // Handle Geolocation Push
  const pushLocationUpdate = useCallback(async (lat, lng, accuracy) => {
    try {
      await axios.post(
        `${apiBaseUrl}/api/locations/trip/${trip.id}/share`,
        {
          latitude: lat,
          longitude: lng,
          accuracy: accuracy || null,
          statusMessage: myStatusMessage,
          isSharing: true
        },
        { headers }
      );
      setMyCoords({ lat, lng });
      fetchMapData();
    } catch (err) {
      console.error('Failed to post location update:', err);
    }
  }, [apiBaseUrl, trip?.id, headers, myStatusMessage, fetchMapData]);

  // Toggle Live Location Sharing
  const handleToggleSharing = () => {
    if (isSharingLive) {
      // STOP SHARING
      if (sharingIntervalId) {
        clearInterval(sharingIntervalId);
        setSharingIntervalId(null);
      }
      setIsSharingLive(false);
      axios.put(`${apiBaseUrl}/api/locations/trip/${trip.id}/toggle`, { isSharing: false }, { headers })
        .then(() => {
          setSuccess('Location sharing stopped.');
          setTimeout(() => setSuccess(''), 3000);
          fetchMapData();
        })
        .catch(err => console.error('Error toggling location off:', err));
    } else {
      // START SHARING
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        return;
      }
      setIsLocating(true);
      setError('');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setIsLocating(false);
          setIsSharingLive(true);
          pushLocationUpdate(latitude, longitude, accuracy);
          setSuccess('Sharing live location with trip friends! 📍');
          setTimeout(() => setSuccess(''), 3500);

          // Fly map to user's location
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 15);
          }

          // Periodic refresh of GPS coordinates every 25 seconds
          const id = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
              (p) => pushLocationUpdate(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
              (e) => console.warn('Periodic GPS error:', e.message),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          }, 25000);
          setSharingIntervalId(id);
        },
        (err) => {
          setIsLocating(false);
          setError(`Unable to retrieve location: ${err.message}. Please allow location access in your browser.`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  // Search OpenStreetMap Nominatim for places / attractions
  const handleSearchPlaces = async (e) => {
    e.preventDefault();
    if (!destSearchQuery.trim()) return;
    setIsSearchingDest(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/locations/search?q=${encodeURIComponent(destSearchQuery)}`, { headers });
      setDestSearchResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearchingDest(false);
    }
  };

  // Pick a search result to autofill destination
  const handleSelectSearchResult = (result) => {
    setNewDest(prev => ({
      ...prev,
      name: result.name || result.displayName.split(',')[0],
      latitude: result.latitude.toFixed(6),
      longitude: result.longitude.toFixed(6),
      address: result.displayName
    }));
    setDestSearchResults([]);
    setDestSearchQuery('');

    // Pan map to chosen point
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([result.latitude, result.longitude], 15);
    }
  };

  // Save New Destination
  const handleSaveDestination = async (e) => {
    e.preventDefault();
    setError('');
    const lat = parseFloat(newDest.latitude);
    const lng = parseFloat(newDest.longitude);

    if (!newDest.name.trim()) {
      setError('Please enter a destination name.');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      setError('Please provide valid latitude and longitude coordinates.');
      return;
    }

    try {
      await axios.post(
        `${apiBaseUrl}/api/locations/trip/${trip.id}/destinations`,
        {
          name: newDest.name,
          category: newDest.category,
          latitude: lat,
          longitude: lng,
          address: newDest.address,
          notes: newDest.notes,
          plannedDate: newDest.plannedDate || null
        },
        { headers }
      );

      setSuccess(`Added "${newDest.name}" to trip destinations! 📍`);
      setTimeout(() => setSuccess(''), 3500);
      setShowAddDestForm(false);
      setNewDest({
        name: '',
        category: 'Attraction',
        latitude: '',
        longitude: '',
        address: '',
        notes: '',
        plannedDate: ''
      });
      fetchMapData();
      if (onRefreshTrip) onRefreshTrip();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add destination.');
    }
  };

  // Delete Destination
  const handleDeleteDestination = async (destId, destName) => {
    if (!window.confirm(`Remove "${destName}" from destinations?`)) return;
    try {
      await axios.delete(`${apiBaseUrl}/api/locations/trip/${trip.id}/destinations/${destId}`, { headers });
      setSuccess(`Removed "${destName}".`);
      setTimeout(() => setSuccess(''), 3000);
      fetchMapData();
      if (onRefreshTrip) onRefreshTrip();
    } catch (err) {
      setError('Failed to remove destination.');
    }
  };

  // Fly map to a specific location
  const handleFlyTo = (lat, lng) => {
    if (mapInstanceRef.current && lat && lng) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', fontFamily: 'var(--sans)' }}>
      {/* Notifications / Alerts */}
      {error && (
        <div style={{ padding: '12px 18px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', borderRadius: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 18px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', borderRadius: '12px', fontWeight: '600' }}>
          ✅ {success}
        </div>
      )}

      {/* TOP BAR: Controls & Live Location Sharing Status */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        padding: '20px 24px',
        backgroundColor: 'var(--code-bg)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow)'
      }}>
        {/* Left: Live status toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleSharing}
            disabled={isLocating}
            style={{
              padding: '12px 24px',
              backgroundColor: isSharingLive ? '#dc3545' : 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow)',
              transition: 'transform 0.1s'
            }}
          >
            {isLocating ? '📡 Locating...' : isSharingLive ? '🛑 Stop Sharing Location' : '📍 Share My Live Location'}
          </button>

          {isSharingLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={myStatusMessage}
                onChange={e => setMyStatusMessage(e.target.value)}
                onBlur={() => {
                  if (myCoords) pushLocationUpdate(myCoords.lat, myCoords.lng);
                }}
                placeholder="Status: e.g. At the airport"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: '13px',
                  color: 'var(--text-h)',
                  width: '200px'
                }}
              />
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>
                🟢 Sharing Active
              </span>
            </div>
          )}
        </div>

        {/* Right: Map Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (myCoords) handleFlyTo(myCoords.lat, myCoords.lng);
              else handleToggleSharing();
            }}
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'var(--text-h)'
            }}
          >
            🎯 Center on Me
          </button>

          <button
            onClick={() => setShowAddDestForm(!showAddDestForm)}
            style={{
              padding: '10px 18px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
          >
            {showAddDestForm ? '✕ Close Form' : '+ Add Destination / Spot 📌'}
          </button>
        </div>
      </div>

      {/* ADD DESTINATION FORM */}
      {showAddDestForm && (
        <div style={{
          padding: '24px',
          backgroundColor: 'var(--bg)',
          border: '2px solid var(--accent)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Add Trip Destination or Itinerary Point 📍</h3>
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Tip: Search for a place, or click anywhere on the map below to auto-fill coordinates!
            </span>
          </div>

          {/* Place Search Autocomplete (OpenStreetMap Nominatim) */}
          <form onSubmit={handleSearchPlaces} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search worldwide places, hotels, landmarks (e.g. Victoria Memorial, Eiffel Tower)..."
              value={destSearchQuery}
              onChange={e => setDestSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--code-bg)',
                fontSize: '14px',
                color: 'var(--text-h)'
              }}
            />
            <button
              type="submit"
              disabled={isSearchingDest}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              {isSearchingDest ? 'Searching...' : '🔍 Search Place'}
            </button>
          </form>

          {/* Search Results Autocomplete Dropdown */}
          {destSearchResults.length > 0 && (
            <div style={{
              backgroundColor: 'var(--code-bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              maxHeight: '200px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {destSearchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-bg)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <strong style={{ color: 'var(--text-h)' }}>{item.name}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text)' }}>{item.displayName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Destination Form Fields */}
          <form onSubmit={handleSaveDestination} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
              Place / Destination Name *
              <input
                type="text"
                placeholder="e.g. Radisson Blu Hotel"
                value={newDest.name}
                onChange={e => setNewDest({ ...newDest, name: e.target.value })}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
              Category
              <select
                value={newDest.category}
                onChange={e => setNewDest({ ...newDest, category: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
              Latitude *
              <input
                type="number"
                step="any"
                placeholder="e.g. 22.5726"
                value={newDest.latitude}
                onChange={e => setNewDest({ ...newDest, latitude: e.target.value })}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
              Longitude *
              <input
                type="number"
                step="any"
                placeholder="e.g. 88.3639"
                value={newDest.longitude}
                onChange={e => setNewDest({ ...newDest, longitude: e.target.value })}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
              Address / Location Details
              <input
                type="text"
                placeholder="Street, City, Landmark"
                value={newDest.address}
                onChange={e => setNewDest({ ...newDest, address: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
              Planned Visit Date
              <input
                type="date"
                value={newDest.plannedDate}
                onChange={e => setNewDest({ ...newDest, plannedDate: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px', gridColumn: '1 / -1' }}>
              Notes / Itinerary Instructions
              <input
                type="text"
                placeholder="e.g. Check-in by 2 PM, meet near front lobby"
                value={newDest.notes}
                onChange={e => setNewDest({ ...newDest, notes: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '10px', gridColumn: '1 / -1', marginTop: '10px' }}>
              <button
                type="submit"
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Save Destination Pin 📍
              </button>
              <button
                type="button"
                onClick={() => setShowAddDestForm(false)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: 'var(--text)'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MAIN LEAFLET MAP CONTAINER */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '520px',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)'
      }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

        {/* Floating Quick Legend Overlay */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderRadius: '14px',
          padding: '10px 14px',
          fontSize: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Map Legend</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#aa3bff', display: 'inline-block' }}></span>
            <span>You / Trip Friends (Live)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#28a745', display: 'inline-block' }}></span>
            <span>Meeting Point / Destinations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#337BFF', display: 'inline-block' }}></span>
            <span>Hotel / Accommodation</span>
          </div>
        </div>
      </div>

      {/* LOWER SPLIT: Friends Live Locations & Destinations List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '25px', marginTop: '10px' }}>
        
        {/* Friends Live Locations Card Feed */}
        <div style={{
          padding: '24px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Friends Live Locations 👥</h3>
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              {memberLocations.filter(m => m.isSharing).length} sharing now
            </span>
          </div>

          {memberLocations.length === 0 ? (
            <p style={{ fontStyle: 'italic', fontSize: '14px', color: 'var(--text)' }}>
              No members are sharing their location yet. Click "Share My Live Location" above to start!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
              {memberLocations.map(mLoc => {
                const isMe = mLoc.userId === currentUser.id;
                const distance = myCoords && mLoc.latitude && mLoc.longitude
                  ? getDistanceFromLatLonInKm(myCoords.lat, myCoords.lng, mLoc.latitude, mLoc.longitude)
                  : null;

                return (
                  <div
                    key={mLoc.id}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--code-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: isMe ? 'var(--accent)' : '#00b4d8',
                        color: 'white',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}>
                        {mLoc.user?.avatarUrl ? (
                          <img src={mLoc.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          mLoc.user?.name ? mLoc.user.name.charAt(0).toUpperCase() : '?'
                        )}
                        <span style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: mLoc.isSharing ? '#10b981' : '#999',
                          border: '2px solid white'
                        }}></span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--text-h)' }}>
                            {mLoc.user?.name} {isMe && '(You)'}
                          </strong>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            backgroundColor: mLoc.isSharing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.2)',
                            color: mLoc.isSharing ? '#10b981' : '#6b7280'
                          }}>
                            {mLoc.isSharing ? 'Live' : 'Paused'}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text)' }}>
                          {mLoc.statusMessage || 'Sharing location'} • {mLoc.freshness}
                        </p>
                        {distance && !isMe && (
                          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold' }}>
                            📏 {distance} km away
                          </span>
                        )}
                      </div>
                    </div>

                    {mLoc.isSharing && mLoc.latitude && mLoc.longitude && (
                      <button
                        onClick={() => handleFlyTo(mLoc.latitude, mLoc.longitude)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: 'var(--accent)'
                        }}
                      >
                        Locate 🎯
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trip Destinations Itinerary List */}
        <div style={{
          padding: '24px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Trip Destinations & Stops 📍</h3>
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              {destinations.length} pinned places
            </span>
          </div>

          {destinations.length === 0 ? (
            <p style={{ fontStyle: 'italic', fontSize: '14px', color: 'var(--text)' }}>
              No destination points pinned yet. Click "+ Add Destination" to pin hotels, sightseeing spots, and meeting points!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
              {destinations.map(dest => {
                const catObj = CATEGORIES.find(c => c.id === dest.category) || CATEGORIES[0];
                const distanceToMe = myCoords
                  ? getDistanceFromLatLonInKm(myCoords.lat, myCoords.lng, dest.latitude, dest.longitude)
                  : null;

                return (
                  <div
                    key={dest.id}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--code-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{catObj.icon}</span>
                        <div>
                          <strong style={{ fontSize: '15px', color: 'var(--text-h)' }}>{dest.name}</strong>
                          <span style={{
                            display: 'inline-block',
                            marginLeft: '8px',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: `${catObj.color}22`,
                            color: catObj.color
                          }}>
                            {catObj.label.split('/')[0]}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDestination(dest.id, dest.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc3545',
                          fontSize: '13px'
                        }}
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>

                    {dest.address && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text)' }}>
                        📍 {dest.address}
                      </p>
                    )}

                    {dest.notes && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-h)', fontStyle: 'italic' }}>
                        📝 "{dest.notes}"
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      {distanceToMe ? (
                        <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>
                          📏 {distanceToMe} km away
                        </span>
                      ) : <span />}

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleFlyTo(dest.latitude, dest.longitude)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: 'var(--text-h)'
                          }}
                        >
                          View on Map 🎯
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          Directions ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
