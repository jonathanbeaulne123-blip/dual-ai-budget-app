import { useState } from "react";
import {
  DEFAULT_GOOGLE_SERVICES,
  GOOGLE_SERVICE_COPY,
  GOOGLE_SERVICES,
  SENSITIVE_GOOGLE_SERVICES,
  findActiveGoogleLink,
  formatDateLabel,
  linkGoogleIdentity,
  setGoogleServices,
  shapeGoogle,
  touchGoogleConfirmation,
  uniqueGoogleServices,
  unlinkGoogleIdentity,
  type CommitResult,
  type Environment,
  type GoogleService,
  type Household,
} from "./core/index.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import {
  connectGoogle,
  describeGooglePing,
  disconnectGoogle,
  googleConfigured,
  loadGoogleSession,
  syncGoogleSuite,
  type GoogleSuitePing,
} from "./google/index.ts";

export function GoogleBridgeCard(props: {
  household: Household;
  environment: Environment;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onError: (message: string) => void;
}) {
  const { household, environment, memberId } = props;
  const google = shapeGoogle(household.google);
  const configured = googleConfigured();
  const [busy, setBusy] = useState(false);
  const [pings, setPings] = useState<GoogleSuitePing[]>([]);
  const [pendingService, setPendingService] = useState<GoogleService | null>(null);
  const working = busy || props.busy;
  const linkedCount = google.links.filter((link) => link.active).length;

  async function connectMember(who: string) {
    setBusy(true);
    props.onError("");
    try {
      const session = await connectGoogle({
        environment,
        memberId: who,
        services: google.enabledServices.length ? google.enabledServices : DEFAULT_GOOGLE_SERVICES,
        enabledServices: google.enabledServices,
      });
      props.onCommand((current) => linkGoogleIdentity(current, {
        memberId: who,
        email: session.identity.email,
        subject: session.identity.subject,
        displayName: session.identity.displayName,
        grantedScopes: session.grantedScopes,
      }));
    } catch (caught) {
      props.onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function disconnectMember(who: string) {
    disconnectGoogle(environment, who);
    props.onCommand((current) => unlinkGoogleIdentity(current, who));
  }

  async function confirmMe() {
    setBusy(true);
    props.onError("");
    try {
      const session = await connectGoogle({
        environment,
        memberId,
        services: ["identity"],
        stepUp: true,
        loginHint: findActiveGoogleLink(household, memberId)?.email,
      });
      const link = findActiveGoogleLink(household, memberId);
      if (link && session.identity.email.toLowerCase() !== link.email && session.identity.subject !== link.subject) {
        throw new Error(`Google signed in as ${session.identity.email}, not ${link.email}.`);
      }
      if (!link) {
        props.onCommand((current) => linkGoogleIdentity(current, {
          memberId,
          email: session.identity.email,
          subject: session.identity.subject,
          displayName: session.identity.displayName,
          grantedScopes: session.grantedScopes,
        }));
      } else {
        props.onCommand((current) => touchGoogleConfirmation(current, memberId));
      }
    } catch (caught) {
      props.onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    props.onError("");
    try {
      const result = await syncGoogleSuite({
        environment,
        memberId,
        enabledServices: google.enabledServices,
      });
      setPings(result);
      if (findActiveGoogleLink(household, memberId)) {
        props.onCommand((current) => touchGoogleConfirmation(current, memberId));
      }
    } catch (caught) {
      props.onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function toggleService(service: GoogleService, on: boolean) {
    if (service === "identity") return;
    const next = on
      ? uniqueGoogleServices([...google.enabledServices, service])
      : google.enabledServices.filter((item) => item !== service);
    if (on && SENSITIVE_GOOGLE_SERVICES.includes(service)) {
      setPendingService(service);
      return;
    }
    props.onCommand((current) => setGoogleServices(current, next));
  }

  const pendingCopy = pendingService ? GOOGLE_SERVICE_COPY[pendingService] : null;

  return (
    <section className="card">
      <header>
        <h2>Google household bridge</h2>
        <span className={`pill ${linkedCount ? "good" : ""}`}>{linkedCount ? `${linkedCount} linked` : "Set up identity"}</span>
      </header>
      <p>
        Google is how Jonathan and Bianca find their personal and household ledgers on another device.
        Tokens stay on this device in the browser store (native Keychain is a later release). The shared snapshot only remembers who is linked — never the password.
        Sign out and clear this phone removes local tokens; the cloud household remains. Development sync retries automatically after sign-in or reconnection. Google never posts money.
      </p>
      {household.members.filter((member) => member.active).sort((left, right) => {
        if (left.id === memberId) return -1;
        if (right.id === memberId) return 1;
        return left.name.localeCompare(right.name);
      }).map((member) => {
        const link = findActiveGoogleLink(household, member.id);
        const onPhone = Boolean(loadGoogleSession(environment, member.id));
        return (
          <div className="row" key={member.id}>
            <span>
              <i className="swatch" style={{ background: member.color }} /> {member.name}
              <span className="muted">
                {" "}
                {link
                  ? `${link.email}${onPhone ? "" : " · connect on this phone"}`
                  : onPhone
                    ? "signed in on this phone, not linked yet"
                    : "not linked"}
              </span>
              {link?.lastConfirmedAt && (
                <span className="muted"> · confirmed {formatDateLabel(link.lastConfirmedAt.slice(0, 10))}</span>
              )}
            </span>
            {link ? (
              <button className="chip" disabled={working} onClick={() => disconnectMember(member.id)}>
                Unlink
              </button>
            ) : (
              <button className="chip selected" disabled={working || !configured} onClick={() => void connectMember(member.id)}>
                Link
              </button>
            )}
          </div>
        );
      })}
      {!configured && (
        <p className="muted">
          Add a Google Cloud web client ID as <code>VITE_GOOGLE_CLIENT_ID</code> on this build
          (this site as an authorized origin). Until then, Calendar still has the month board and an .ics file.
        </p>
      )}
      <p className="muted" style={{ marginTop: 12 }}>What this household lets Google do</p>
      {GOOGLE_SERVICES.map((service) => {
        const copy = GOOGLE_SERVICE_COPY[service];
        const on = google.enabledServices.includes(service);
        return (
          <div className="row" key={service}>
            <span>
              {copy.label}
              <span className="muted"> — {copy.summary}</span>
            </span>
            {service === "identity" ? (
              <span className="muted">always</span>
            ) : (
              <button
                className={`chip ${on ? "selected" : ""}`}
                disabled={working}
                onClick={() => toggleService(service, !on)}
              >
                {on ? "On" : "Off"}
              </button>
            )}
          </div>
        );
      })}
      <button className="primary" disabled={working || !configured} onClick={() => void confirmMe()}>
        {working ? "Talking to Google…" : "Confirm it is me"}
      </button>
      <button className="ghost" style={{ width: "100%", marginTop: 8 }} disabled={working || !configured} onClick={() => void syncNow()}>
        Sync Google now
      </button>
      {pings.length > 0 && (
        <ul className="health" style={{ marginTop: 12 }}>
          {pings.map((ping) => (
            <li key={ping.service}>{describeGooglePing(ping)}</li>
          ))}
        </ul>
      )}
      {pendingCopy && pendingService && (
        <ConfirmSheet
          title={`Turn on ${pendingCopy.label}?`}
          body={`${pendingCopy.summary} Google never posts money. Google treats some of these as sensitive — add this kitchen site’s test users in Google Cloud until the app is verified.`}
          confirmLabel={`Turn on ${pendingCopy.label}`}
          busy={working}
          onCancel={() => setPendingService(null)}
          onConfirm={() => {
            const service = pendingService;
            setPendingService(null);
            props.onCommand((current) => setGoogleServices(current, uniqueGoogleServices([...google.enabledServices, service])));
          }}
        />
      )}
    </section>
  );
}
