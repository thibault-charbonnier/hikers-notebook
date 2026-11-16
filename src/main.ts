import { mount } from "svelte";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "maplibre-gl/dist/maplibre-gl.css";
import "./app.css";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
