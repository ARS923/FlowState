// SignupCard.jsx - Deliberately broken for FlowState testing

export default function SignupCard() {
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted");
  };

  return (
    <div style={styles.card}>
      <div style={styles.avatarPlaceholder}>No image</div>

      <h2 style={styles.heading}>Create Account</h2>

      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            style={styles.input}
          />
        </div>

        <button type="submit" style={styles.submitBtn}>
          Sign Up
        </button>
      </form>
    </div>
  );
}

const styles = {
  card: {
    background: "#16213e",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "400px",
    margin: "0 auto",
  },
  avatarPlaceholder: {
    width: "80px",
    height: "80px",
    background: "#2a2a4a",
    borderRadius: "50%",
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#555",
    fontSize: "12px",
  },
  heading: {
    margin: "0 0 20px 0",
    fontSize: "18px", // TOO SMALL - should be 24px
    color: "white",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    color: "#a0a0a0",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #3a3a5c",
    borderRadius: "8px",
    background: "#0f0f23",
    color: "white",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  submitBtn: {
    background: "#ff6b6b", // WRONG - clashes with dark theme
    color: "#333", // LOW CONTRAST
    border: "none",
    padding: "8px 12px", // TOO SMALL - inconsistent with inputs
    borderRadius: "4px", // INCONSISTENT - inputs have 8px
    fontSize: "14px", // INCONSISTENT - inputs have 16px
    cursor: "pointer",
    marginTop: "8px",
    // Missing: width: "100%" to match inputs
  },
};
