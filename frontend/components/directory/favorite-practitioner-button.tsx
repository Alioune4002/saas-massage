"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addGuestFavorite, getGuestFavorites, removeGuestFavorite } from "@/lib/api";

type FavoritePractitionerButtonProps = {
  professionalSlug: string;
};

export function FavoritePractitionerButton({
  professionalSlug,
}: FavoritePractitionerButtonProps) {
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await getGuestFavorites();
        if (!active) {
          return;
        }
        setFavorite(result.favorites.some((item) => item.slug === professionalSlug));
      } catch {
        if (!active) {
          return;
        }
        setFavorite(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [professionalSlug]);

  async function handleToggle() {
    try {
      setBusy(true);
      if (favorite) {
        await removeGuestFavorite(professionalSlug);
        setFavorite(false);
      } else {
        await addGuestFavorite(professionalSlug);
        setFavorite(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={favorite ? "primary" : "secondary"}
      size="sm"
      iconLeft={<Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />}
      onClick={handleToggle}
      disabled={busy}
    >
      {favorite ? "Dans mes favoris" : "Ajouter aux favoris"}
    </Button>
  );
}
