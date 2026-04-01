import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);

  @ViewChild('heroCanvas') private heroCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('planeEl') private planeEl!: ElementRef<HTMLElement>;

  /* ---- Auth ---- */
  mode: 'login' | 'register' = 'login';
  email = '';
  password = '';
  passwordConfirm = '';
  error = '';
  loading = false;
  showModal = false;
  nearPlane = false;

  /* ---- Plane ---- */
  private planeX = 0;
  private planeY = 0;
  private targetX = 0;
  private targetY = 0;
  private prevX = 0;
  private planeRot = 0;
  private barrelAngle = 0;
  private isRolling = false;
  private particles: Particle[] = [];
  private ctx!: CanvasRenderingContext2D;
  private rafId = 0;
  private tick = 0;

  // Engine offsets from plane center in display-px (plane SVG: 220x62px, viewBox 225 275 350 98)
  // left engine: cx=325,cy=340 → local(100,65) → display(63,41) → offset(-47, 11)
  // right engine: cx=476,cy=340 → local(251,65) → display(158,41) → offset(48, 11)
  private readonly HALF_W = 110;
  private readonly HALF_H = 31;
  private readonly ENGINES = [
    { ox: -47, oy: 11 },
    { ox: 48, oy: 11 },
  ];

  /* ---- Lifecycle ---- */
  ngAfterViewInit() {
    const canvas = this.heroCanvas?.nativeElement;
    if (!canvas) return;
    this.resizeCanvas();
    this.ctx = canvas.getContext('2d')!;
    this.planeX = this.targetX = this.prevX = window.innerWidth * 0.72;
    this.planeY = this.targetY = window.innerHeight * 0.36;
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
    document.body.style.overflow = '';
  }

  /* ---- Event listeners ---- */
  @HostListener('window:resize')
  resizeCanvas() {
    const c = this.heroCanvas?.nativeElement;
    if (c) {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.showModal) return;
    this.targetX = e.clientX;
    this.targetY = e.clientY;
    const dx = e.clientX - this.planeX;
    const dy = e.clientY - this.planeY;
    this.nearPlane = Math.sqrt(dx * dx + dy * dy) < 100;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeModal();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.showModal || this.isRolling) return;
    const dx = e.clientX - this.planeX;
    const dy = e.clientY - this.planeY;
    if (Math.abs(dx) < this.HALF_W && Math.abs(dy) < this.HALF_H * 3) {
      this.barrelRoll();
    }
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---- Barrel roll ---- */
  private barrelRoll() {
    this.isRolling = true;
    const start = performance.now();
    const duration = 900;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.barrelAngle = -360 * ease;
      if (t < 1) requestAnimationFrame(animate);
      else {
        this.barrelAngle = 0;
        this.isRolling = false;
      }
    };
    requestAnimationFrame(animate);
  }

  /* ---- Main loop ---- */
  private loop() {
    const lerp = 0.09;
    this.planeX += (this.targetX - this.planeX) * lerp;
    this.planeY += (this.targetY - this.planeY) * lerp;

    const velX = this.planeX - this.prevX;
    this.planeRot += (velX * 2.8 - this.planeRot) * 0.1;
    this.prevX = this.planeX;

    const totalRot = this.planeRot + this.barrelAngle;

    if (this.planeEl) {
      this.planeEl.nativeElement.style.transform = `translate(${this.planeX - this.HALF_W}px, ${this.planeY - this.HALF_H}px) rotate(${totalRot}deg)`;
    }

    this.tick++;
    if (!this.showModal && this.tick % 2 === 0) this.emitParticles(totalRot);
    this.drawParticles();

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  /* ---- Particles ---- */
  private emitParticles(totalRotDeg: number) {
    const rad = (totalRotDeg * Math.PI) / 180;
    const cos = Math.cos(rad),
      sin = Math.sin(rad);

    for (const { ox, oy } of this.ENGINES) {
      const wx = this.planeX + ox * cos - oy * sin;
      const wy = this.planeY + ox * sin + oy * cos;
      for (let i = 0; i < 3; i++) {
        const spread = (Math.random() - 0.5) * 1.4;
        const backAngle = rad + Math.PI + spread;
        const speed = 1.0 + Math.random() * 2.2;
        this.particles.push({
          x: wx + (Math.random() - 0.5) * 5,
          y: wy + (Math.random() - 0.5) * 5,
          vx: Math.cos(backAngle) * speed,
          vy: Math.sin(backAngle) * speed,
          r: 3.5 + Math.random() * 3.5,
          a: 0.6 + Math.random() * 0.35,
        });
      }
    }
    if (this.particles.length > 1000) this.particles.splice(0, 300);
  }

  private drawParticles() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (this.showModal) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045;
      p.vx *= 0.992;
      p.r *= 0.968;
      p.a *= 0.942;

      if (p.a < 0.018 || p.r < 0.22) {
        this.particles.splice(i, 1);
        continue;
      }

      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(255,255,255,${p.a})`);
      g.addColorStop(0.5, `rgba(165,180,252,${p.a * 0.7})`);
      g.addColorStop(1, `rgba(99,102,241,${p.a * 0.15})`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  /* ---- Auth ---- */
  openModal(m: 'login' | 'register') {
    this.mode = m;
    this.error = '';
    this.password = '';
    this.passwordConfirm = '';
    this.showModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.showModal = false;
    document.body.style.overflow = '';
  }

  toggleMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error = '';
    this.password = '';
    this.passwordConfirm = '';
  }

  async submit() {
    this.error = '';
    if (!this.email || !this.password) {
      this.error = 'Preenche o email e a senha.';
      return;
    }
    if (this.mode === 'register') {
      if (this.password.length < 6) {
        this.error = 'A senha deve ter pelo menos 6 caracteres.';
        return;
      }
      if (this.password !== this.passwordConfirm) {
        this.error = 'As senhas não coincidem.';
        return;
      }
    }
    this.loading = true;
    try {
      if (this.mode === 'login') await this.auth.login(this.email, this.password);
      else await this.auth.register(this.email, this.password);
      this.router.navigate(['/']);
    } catch (err: any) {
      this.error = this.mapError(err.code);
    } finally {
      this.loading = false;
    }
  }

  private mapError(code: string): string {
    const map: Record<string, string> = {
      'auth/user-not-found': 'Conta não encontrada.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'Email ou senha incorretos.',
      'auth/email-already-in-use': 'Este email já está registado.',
      'auth/invalid-email': 'Email inválido.',
      'auth/too-many-requests': 'Demasiadas tentativas. Tenta mais tarde.',
    };
    return map[code] ?? 'Ocorreu um erro. Tenta novamente.';
  }
}
