# ═══════════════════════════════════════════════════════════
#  Fast Frame Sorocaba — app.py
#  Login protegido server-side com Flask session
# ═══════════════════════════════════════════════════════════

import os
from flask import Flask, render_template, request, redirect, url_for, session, flash
from functools import wraps

app = Flask(__name__)

# Chave secreta para assinar a sessão — MUDE em produção!
# Ideal: definir via variável de ambiente SECRET_KEY
app.secret_key = os.environ.get('SECRET_KEY', 'fastframe-dev-secret-2026-mude-em-producao')

# ── Credenciais ──────────────────────────────────────────
# Em produção: use variáveis de ambiente ou banco de dados
# Ex: export FF_USER=admin && export FF_PASS=minhasenha
APP_USER = os.environ.get('FF_USER', 'fastframe')
APP_PASS = os.environ.get('FF_PASS', 'sorocaba2026')

# ── Decorator de proteção de rota ─────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated

# ── Rotas ────────────────────────────────────────────────
@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('logged_in'):
        return redirect(url_for('index'))

    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if username == APP_USER and password == APP_PASS:
            session['logged_in'] = True
            session['username'] = username
            next_url = request.args.get('next') or url_for('index')
            return redirect(next_url)
        else:
            error = 'Usuário ou senha incorretos.'

    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

# ── Inicialização ─────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
