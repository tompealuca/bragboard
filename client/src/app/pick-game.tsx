import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, EmptyState, GameIcon, Input, Row, Screen } from '@/components/ui';
import { useGamesByRecency } from '@/lib/queries';
import { modeLabel } from '@/lib/templates';
import { spacing } from '@/lib/theme';

export default function PickGame() {
  const games = useGamesByRecency();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? games.filter((g) => g.name.toLowerCase().includes(q)) : games;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      {games.length > 6 && (
        <Input icon="search" placeholder="Search your games" value={query} onChangeText={setQuery} autoCorrect={false} />
      )}
      {games.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🎲"
            title="Add a game first"
            text="Pick a ready-made game or create your own, then start scoring."
            action="Add a game"
            onAction={() => router.replace('/game/new?then=play')}
          />
        </Card>
      ) : (
        <Card style={{ paddingVertical: spacing.sm }}>
          {filtered.map((g) => (
            <Row
              key={g.id}
              left={<GameIcon emoji={g.emoji} color={g.color} />}
              title={g.name}
              subtitle={modeLabel(g.config, true)}
              onPress={() => router.replace(`/play/${g.id}`)}
              chevron
            />
          ))}
        </Card>
      )}
      {games.length > 0 && (
        <Button title="Add a new game" variant="soft" icon="add" onPress={() => router.replace('/game/new?then=play')} />
      )}
    </Screen>
  );
}
