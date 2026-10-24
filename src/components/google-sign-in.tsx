"use client";

export function GoogleSignInButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => Promise<void>;
}) {
  return (
    <button
      type="button"
      className="button google-sign-in w-full"
      disabled={busy}
      onClick={onClick}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
        <path
          fill="#4285F4"
          d="M43.6 24.5c0-1.4-.1-2.8-.4-4.2H24v8h11c-.5 2.5-1.9 4.6-4.1 6v5.2h6.7c3.9-3.6 6-8.8 6-15z"
        />
        <path
          fill="#34A853"
          d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20.4 20.4 0 0 0 24 44z"
        />
        <path
          fill="#FBBC05"
          d="M12.6 27.4a12.3 12.3 0 0 1 0-7.8v-5.4H5.7a20.4 20.4 0 0 0 0 18.6z"
        />
        <path
          fill="#EA4335"
          d="M24 11.2c3 0 5.7 1 7.8 3l5.9-5.9A19.5 19.5 0 0 0 24 3 20.4 20.4 0 0 0 5.7 14.2l6.9 5.4c1.6-4.8 6.1-8.4 11.4-8.4z"
        />
      </svg>
      เข้าสู่ระบบด้วย Google
    </button>
  );
}
