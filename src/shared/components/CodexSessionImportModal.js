"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "@/shared/components";

/**
 * Codex ChatGPT Session Import Modal
 * User pastes the full https://chatgpt.com/api/auth/session JSON.
 * The object's accessToken (a JWT) + account info are sent to the
 * import-token route, which extracts everything it needs server-side.
 */
export default function CodexSessionImportModal({ isOpen, onSuccess, onClose }) {
  const [sessionInput, setSessionInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const raw = sessionInput.trim();
    if (!raw) {
      setError("Please paste your ChatGPT session JSON");
      return;
    }

    // Parse + validate client-side. Never proceed without a valid accessToken.
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("Invalid JSON. Paste the full session object exactly as shown.");
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("Session must be a JSON object.");
      return;
    }

    // Accept either accessToken or access_token.
    const token = parsed.accessToken || parsed.access_token;
    if (!token || typeof token !== "string" || !token.trim()) {
      setError('Missing "accessToken" — the session JSON looks incomplete.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/codex/import-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSessionInput("");
    setError(null);
    setSuccess(false);
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import ChatGPT Session" size="lg">
      <div className="space-y-4">
        {success ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-lg font-medium text-text-primary">Session Imported!</p>
            <p className="text-sm text-text-muted mt-2">Codex connection added</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm text-text-muted">
                Paste the full JSON from{" "}
                <a
                  href="https://chatgpt.com/api/auth/session"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  chatgpt.com/api/auth/session
                </a>
              </p>
              <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
                <p className="font-medium text-text-primary">How to get it:</p>
                <ol className="list-decimal list-inside space-y-1 text-text-muted">
                  <li>Log in at chatgpt.com in your browser</li>
                  <li>
                    Open{" "}
                    <span className="font-mono">chatgpt.com/api/auth/session</span> in a new
                    tab
                  </li>
                  <li>Select all and copy the entire JSON object</li>
                  <li>Paste it below</li>
                </ol>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">
                Session JSON
              </label>
              <textarea
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                placeholder='{ "accessToken": "eyJ...", "account": { ... }, ... }'
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
                rows={8}
                disabled={loading}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose} disabled={loading} fullWidth>
                Cancel
              </Button>
              <Button onClick={handleSubmit} loading={loading} disabled={loading} fullWidth>
                Import
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

CodexSessionImportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
};
