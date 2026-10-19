import { mount } from 'svelte';
import App from './App.svelte';
import './index.css';
import './discord.css';

mount(App, {
  target: document.getElementById('app'),
  intro: false
});
