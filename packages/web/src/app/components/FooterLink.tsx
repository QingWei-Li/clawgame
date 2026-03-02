import { Github } from 'lucide-react';

export function FooterLink() {
  return (
    <footer className="footer">
      <a href="https://github.com/tnegamer/clawgame" target="_blank" rel="noopener noreferrer" className="footer-link">
        <Github size={20} />
        <span>GitHub</span>
      </a>
    </footer>
  );
}
