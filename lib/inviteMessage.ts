// Shared by both the server action that emails this message and the client
// components that preview/copy it, so the wording can't drift between the
// two. No "server-only" pragma — this needs to import cleanly into client
// components too.

export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

export function buildInviteMessage(firstName: string, inviteUrl: string): string {
  return `Hi ${firstName}, going forward all maintenance requests will go through our official portal here: ${inviteUrl}. Please bookmark this link on your phone's home screen.`;
}
