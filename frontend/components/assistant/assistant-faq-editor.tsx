"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import type { AssistantFaqItem } from "@/lib/api";

type AssistantFaqEditorProps = {
  items: AssistantFaqItem[];
  onChange: (items: AssistantFaqItem[]) => void;
};

export function AssistantFaqEditor({
  items,
  onChange,
}: AssistantFaqEditorProps) {
  function updateItem(index: number, nextItem: AssistantFaqItem) {
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? nextItem : item
    );
    onChange(nextItems);
  }

  function addItem() {
    onChange([...items, { question: "", answer: "" }]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-[1.4rem] border border-dashed border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
          Ajoute quelques questions fréquentes pour préparer des réponses simples
          sur les prestations, les réservations ou le déroulé d’une séance.
        </div>
      ) : null}

      {items.map((item, index) => (
        <div
          key={`${index}-${item.question}`}
          className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4"
        >
          <div className="grid gap-4">
            <FieldWrapper label={`Question fréquente ${index + 1}`}>
              <Input
                value={item.question}
                onChange={(event) =>
                  updateItem(index, { ...item, question: event.target.value })
                }
                placeholder="Exemple : faut-il prévoir quelque chose avant la séance ?"
              />
            </FieldWrapper>
            <FieldWrapper label="Réponse à transmettre">
              <Textarea
                value={item.answer}
                onChange={(event) =>
                  updateItem(index, { ...item, answer: event.target.value })
                }
                placeholder="Explique simplement ce que le client doit savoir."
              />
            </FieldWrapper>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              iconLeft={<Trash2 className="h-4 w-4" />}
            >
              Retirer
            </Button>
          </div>
        </div>
      ))}

      <Button
        variant="secondary"
        size="md"
        onClick={addItem}
        iconLeft={<Plus className="h-4 w-4" />}
      >
        Ajouter une question fréquente
      </Button>
    </div>
  );
}
