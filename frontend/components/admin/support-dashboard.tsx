"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  createAdminAnnouncement,
  createAdminSupportMessage,
  getAdminAnnouncements,
  getAdminSupportMessages,
  getAdminSupportUsers,
  type AdminAnnouncementRecord,
  type AdminSupportUser,
  type PlatformMessageRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function SupportDashboard() {
  const [users, setUsers] = useState<AdminSupportUser[]>([]);
  const [messages, setMessages] = useState<PlatformMessageRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [query, setQuery] = useState("");

  const loadAll = useCallback(async (search = query) => {
    const [usersData, messagesData, announcementsData] = await Promise.all([
      getAdminSupportUsers({ q: search || undefined }),
      getAdminSupportMessages(),
      getAdminAnnouncements(),
    ]);
    setUsers(usersData);
    setMessages(messagesData);
    setAnnouncements(announcementsData);
    setSelectedUserId((current) => current || usersData[0]?.id || "");
  }, [query]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        await loadAll();
        if (active) {
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger le support.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadAll]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await loadAll(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible.");
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      setError("Sélectionnez un utilisateur avant d’envoyer un message.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      await createAdminSupportMessage({
        recipient_user: selectedUserId,
        category: String(formData.get("category") || "support") as PlatformMessageRecord["category"],
        title: String(formData.get("title") || ""),
        body: String(formData.get("body") || ""),
        display_mode: String(formData.get("display_mode") || "inbox") as PlatformMessageRecord["display_mode"],
        reply_allowed: String(formData.get("reply_allowed") || "") === "on",
        is_active: true,
      });
      setNotice("Message plateforme envoyé.");
      setError("");
      await loadAll();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    }
  }

  async function handleCreateAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await createAdminAnnouncement({
        title: String(formData.get("title") || ""),
        body: String(formData.get("body") || ""),
        audience_role: String(formData.get("audience_role") || "all") as AdminAnnouncementRecord["audience_role"],
        display_mode: String(formData.get("display_mode") || "notice") as AdminAnnouncementRecord["display_mode"],
        is_active: true,
      });
      setNotice("Annonce interne créée.");
      setError("");
      await loadAll();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Annonce impossible.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-[2rem]" />
        <Skeleton className="h-[30rem] rounded-[2rem]" />
      </div>
    );
  }

  const selectedUser = users.find((user) => user.id === selectedUserId) || null;

  return (
    <div className="space-y-6 overflow-x-clip">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Utilisateurs visibles", users.length],
          ["Messages envoyés", messages.length],
          ["Annonces actives", announcements.filter((item) => item.is_active).length],
          ["Messages non lus", messages.filter((item) => !item.is_read).length],
        ].map(([label, value]) => (
          <Card key={String(label)} className="rounded-[1.6rem] p-5">
            <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{String(value)}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Utilisateurs</h2>
          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="email, nom ou praticien"
            />
            <Button type="submit" variant="secondary" className="sm:self-start">Filtrer</Button>
          </form>

          <div className="mt-5 space-y-3">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                  user.id === selectedUserId
                    ? "border-[var(--primary)] bg-[var(--primary)]/8"
                    : "border-[var(--border)] bg-[var(--background-soft)]"
                }`}
              >
                <p className="break-words font-medium text-[var(--foreground)]">
                  {user.professional_name || `${user.first_name} ${user.last_name}`.trim() || user.email}
                </p>
                <p className="mt-1 break-words text-sm text-[var(--foreground-muted)]">
                  {user.email} · {user.role}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Envoyer un message plateforme</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
              Message in-app lié à un utilisateur, avec affichage boîte de réception, bandeau ou popup.
            </p>
            <div className="mt-4 rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
              <p className="break-words font-medium text-[var(--foreground)]">
                {selectedUser?.professional_name || selectedUser?.email || "Aucun utilisateur sélectionné"}
              </p>
              {selectedUser ? (
                <p className="mt-1 break-words text-[var(--foreground-muted)]">
                  {selectedUser.email} · {selectedUser.role}
                </p>
              ) : null}
            </div>
            <form onSubmit={handleSendMessage} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrapper label="Catégorie">
                  <Select name="category" defaultValue="support">
                    <option value="support">support</option>
                    <option value="billing">billing</option>
                    <option value="moderation">moderation</option>
                    <option value="product">product</option>
                    <option value="system">system</option>
                  </Select>
                </FieldWrapper>
                <FieldWrapper label="Affichage">
                  <Select name="display_mode" defaultValue="inbox">
                    <option value="inbox">inbox</option>
                    <option value="notice">notice</option>
                    <option value="popup">popup</option>
                  </Select>
                </FieldWrapper>
              </div>
              <FieldWrapper label="Titre">
                <Input name="title" required />
              </FieldWrapper>
              <FieldWrapper label="Message">
                <Textarea name="body" required />
              </FieldWrapper>
              <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="reply_allowed" />
                Réponse utilisateur autorisée plus tard
              </label>
              <Button type="submit">Envoyer le message</Button>
            </form>
          </Card>

          <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Annonces internes</h2>
            <form onSubmit={handleCreateAnnouncement} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrapper label="Audience">
                  <Select name="audience_role" defaultValue="all">
                    <option value="all">Tous</option>
                    <option value="professional">Praticiens</option>
                    <option value="admin">Admins</option>
                  </Select>
                </FieldWrapper>
                <FieldWrapper label="Affichage">
                  <Select name="display_mode" defaultValue="notice">
                    <option value="notice">notice</option>
                    <option value="popup">popup</option>
                  </Select>
                </FieldWrapper>
              </div>
              <FieldWrapper label="Titre">
                <Input name="title" required />
              </FieldWrapper>
              <FieldWrapper label="Message">
                <Textarea name="body" required />
              </FieldWrapper>
              <Button type="submit" variant="secondary">Créer l’annonce</Button>
            </form>

            <div className="mt-6 space-y-3">
              {announcements.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
                  <p className="break-words font-medium text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-1 break-words text-[var(--foreground-muted)]">
                    {item.audience_role} · {item.display_mode} · {item.is_active ? "active" : "inactive"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Historique messages envoyés</h2>
            <div className="mt-5 space-y-3">
              {messages.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="break-words font-medium text-[var(--foreground)]">{item.title}</p>
                    <p className="text-[var(--foreground-muted)]">
                      {item.is_read ? "lu" : "non lu"} ·{" "}
                      {String(item.metadata?.ticket_status || "en attente")}
                    </p>
                  </div>
                  <p className="mt-1 break-words text-[var(--foreground-muted)]">
                    {item.recipient_name} · {item.category} · {item.display_mode}
                  </p>
                  <p className="mt-3 break-words text-[var(--foreground-muted)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
