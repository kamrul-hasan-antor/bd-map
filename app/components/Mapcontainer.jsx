"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";

const Mapcontainer = () => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const rederBdMap = (map, bdData) => {
    map.addSource("bd", { type: "geojson", data: bdData });

    map.addLayer({
      id: "bd-outline",
      type: "line",
      source: "bd",
      paint: { "line-color": "#000", "line-width": 0.8 },
    });

    // zoom to fit Bangladesh
    const bounds = new maplibregl.LngLatBounds();
    bdData.features.forEach((f) => {
      f.geometry.coordinates.flat(2).forEach(([lng, lat]) => {
        bounds.extend([lng, lat]);
      });
    });

    const center = bounds.getCenter();

    map.setCenter(center);
    map.setMaxBounds([
      [bounds.getWest() - 4.95, bounds.getSouth() - 0.15],
      [bounds.getEast() + 4.95, bounds.getNorth() + 0.15],
    ]);

    map.fitBounds(bounds, { padding: 60 });
  };

  const renderDivisions = (map, divData, popup) => {
    divData.features = divData.features.map((f, i) => ({
      ...f,
      properties: {
        ...f.properties,
        fillColor: divisionColors[i % divisionColors.length],
      },
    }));

    map.addSource("divisions", {
      type: "geojson",
      data: divData,
      generateId: true,
    });

    map.addLayer({
      id: "divisions-fill",
      type: "fill",
      source: "divisions",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 0.6,
      },
    });

    map.addLayer({
      id: "divisions-outline",
      type: "line",
      source: "divisions",
      paint: { "line-color": "#000", "line-width": 0.1 },
    });

    const labelPoints = {
      type: "FeatureCollection",
      features: divData.features.map((feature) => ({
        type: "Feature",
        geometry: turf.centroid(feature).geometry,
        properties: feature.properties,
      })),
    };

    map.addSource("divisions-labels", { type: "geojson", data: labelPoints });

    map.addLayer({
      id: "divisions-label",
      type: "symbol",
      source: "divisions-labels",
      maxzoom: 7.5,
      layout: {
        "text-field": ["get", "ADM1_EN"],
        "text-size": 12,
        "text-anchor": "center",
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    // popup on hover
    let hoveredId = null;

    map.on("mousemove", "divisions-fill", (e) => {
      if (map.getZoom() >= 7.5) {
        popup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;

      const html = `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${props.ADM1_EN}
    </h4>
    <p class="my-1 text-xs text-gray-500">
      <b>Division Code:</b> ${props.ADM1_PCODE}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Country:</b> ${props.ADM0_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Area:</b> ${Number(props.Shape_Area).toFixed(2)} sq. units
    </p>
  </div>
`;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "divisions", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "divisions", id: hoveredId },
        { hovered: true },
      );
    });

    // On mouse leave — remove popup
    map.on("mouseleave", "divisions-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "divisions", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = null;
    });

    // remove popup on zoom
    map.on("zoom", () => {
      if (map.getZoom() >= 7.5) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "divisions", id: hoveredId },
            { hovered: false },
          );
          hoveredId = null;
        }
      }
    });

    // highlight division on hover layer
    map.addLayer({
      id: "divisions-hover",
      type: "fill",
      source: "divisions",
      paint: {
        "fill-color": "#000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hovered"], false],
          0.2,
          0,
        ],
      },
    });
  };

  const renderDistricts = (map, distData, popup) => {
    distData.features = distData.features.map((f, i) => ({
      ...f,
      properties: {
        ...f.properties,
        fillColor: divisionColors[i % divisionColors.length],
      },
    }));

    map.addSource("districts", {
      type: "geojson",
      data: distData,
      generateId: true,
    });

    map.addLayer({
      id: "districts-fill",
      type: "fill",
      source: "districts",
      minzoom: 7.5,
      paint: {
        "fill-color": "transparent",
        // "fill-color": ["get", "fillColor"],
        // "fill-opacity": 0.4,
      },
    });

    map.addLayer({
      id: "districts-outline",
      type: "line",
      source: "districts",
      minzoom: 7.5,
      paint: { "line-color": "#000", "line-width": 0.1 },
    });

    const districtPoints = {
      type: "FeatureCollection",
      features: distData.features.map((f) => ({
        type: "Feature",
        geometry: turf.centroid(f).geometry,
        properties: f.properties,
      })),
    };

    map.addSource("districts-labels", {
      type: "geojson",
      data: districtPoints,
    });

    map.addLayer({
      id: "districts-label",
      type: "symbol",
      source: "districts-labels",
      minzoom: 7.5,
      layout: {
        "text-field": ["get", "ADM2_EN"],
        "text-size": 11,
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    // popup on hover
    let hoveredId = null;

    map.on("mousemove", "districts-fill", (e) => {
      if (map.getZoom() < 7.5) {
        popup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;

      const html = `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${props.ADM2_EN}
    </h4>
    <p class="my-1 text-xs text-gray-500">
      <b>District Code:</b> ${props.ADM2_PCODE}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Country:</b> ${props.ADM0_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Area:</b> ${Number(props.Shape_Area).toFixed(2)} sq. units
    </p>
  </div>
`;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "districts", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "districts", id: hoveredId },
        { hovered: true },
      );
    });

    // On mouse leave — remove popup
    map.on("mouseleave", "districts-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "districts", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = null;
    });

    // remove popup on zoom
    map.on("zoom", () => {
      if (map.getZoom() < 7.5) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "districts", id: hoveredId },
            { hovered: false },
          );
          hoveredId = null;
        }
      }
    });

    // highlight district on hover layer
    map.addLayer({
      id: "districts-hover",
      type: "fill",
      source: "districts",
      paint: {
        "fill-color": "#000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hovered"], false],
          0.2,
          0,
        ],
      },
    });
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      maxZoom: 10,
    });

    map.on("load", async () => {
      const [bdRes, divRes, distRes] = await Promise.all([
        fetch("/data/bd.json"),
        fetch("/data/divisions.json"),
        fetch("/data/districts.json"),
      ]);
      const bdData = await bdRes.json();
      const divData = await divRes.json();
      const distData = await distRes.json();

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      rederBdMap(map, bdData);
      renderDivisions(map, divData, popup);
      renderDistricts(map, distData, popup);

      setLoading(false);
    });

    mapRef.current = map;
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
          <div className="w-12 h-12 border-[5px] border-gray-300 border-t-gray-700 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

const divisionColors = [
  "#00A6B4",
  "#89B8E4",
  "#788CC5",
  "#72C26F",
  "#AC8FC7",
  "#F8AA93",
  "#662D91",
  "#FFCA63",
];
export default Mapcontainer;
