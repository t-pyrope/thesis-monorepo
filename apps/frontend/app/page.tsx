import MainForm from "@/app/MainForm";

import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <MainForm />
      </main>
    </div>
  );
}
