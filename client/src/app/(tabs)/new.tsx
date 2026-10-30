import { Redirect } from 'expo-router';

// Placeholder for the "+" tab; its button opens the game picker instead.
export default function NewTab() {
  return <Redirect href="/pick-game" />;
}
