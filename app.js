// Estado da aplicação
const state = {
    expenses: [],
    settings: {
        geminiKey: '',
        budget: 0,
        alertThreshold: 80
    }
};

// Categorias disponíveis
const categories = {
    alimentacao: '🍔 Alimentação',
    transporte: '🚗 Transporte',
    moradia: '🏠 Moradia',
    saude: '⚕️ Saúde',
    educacao: '📚 Educação',
    lazer: '🎬 Lazer',
    compras: '🛍️ Compras',
    utilidades: '💡 Utilidades',
    outro: '❓ Outro'
};

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    setTodayDate();
    setCurrentMonth();
    updateDashboard();
    registerServiceWorker();
});

// Carregar dados do localStorage
function loadData() {
    const savedExpenses = localStorage.getItem('expenses');
    const savedSettings = localStorage.getItem('settings');
    
    if (savedExpenses) state.expenses = JSON.parse(savedExpenses);
    if (savedSettings) state.settings = JSON.parse(savedSettings);
}

// Salvar dados
function saveData() {
    localStorage.setItem('expenses', JSON.stringify(state.expenses));
    localStorage.setItem('settings', JSON.stringify(state.settings));
}

// Set data atual no campo de data
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Set mês atual no filtro
function setCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('monthFilter').value = `${year}-${month}`;
}

// Alternar abas
function switchTab(tabName) {
    // Remover aba ativa
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    
    // Ativar nova aba
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Atualizar conteúdo específico da aba
    if (tabName === 'analytics') updateAnalytics();
}

// Formulário de despesas
document.getElementById('expenseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    let category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const useAI = document.getElementById('aiCategory').checked;
    
    // Se usar IA para categorizar
    if (useAI && state.settings.geminiKey && !category) {
        showLoading(true);
        category = await categorizarComIA(description);
        showLoading(false);
    }
    
    if (!category) {
        showToast('Por favor, selecione uma categoria', 'error');
        return;
    }
    
    // Adicionar despesa
    const expense = {
        id: Date.now(),
        description,
        amount,
        category,
        date,
        timestamp: new Date().toISOString()
    };
    
    state.expenses.push(expense);
    saveData();
    
    // Limpar formulário
    document.getElementById('expenseForm').reset();
    setTodayDate();
    
    // Atualizar interface
    updateDashboard();
    switchTab('dashboard');
    showToast('✅ Despesa adicionada com sucesso!', 'success');
});

// Categorizar com IA usando Google Gemini
async function categorizarComIA(description) {
    if (!state.settings.geminiKey) {
        showToast('⚠️ Configure sua chave Gemini nas configurações', 'warning');
        return '';
    }
    
    try {
        const prompt = `Analise esta despesa e categorize em uma das seguintes: alimentacao, transporte, moradia, saude, educacao, lazer, compras, utilidades, outro. Responda APENAS com a categoria.
        
Despesa: "${description}"
        
Responda apenas com a palavra da categoria, nada mais.`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${state.settings.geminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });
        
        if (!response.ok) throw new Error('Erro na API');
        
        const data = await response.json();
        const category = data.candidates[0].content.parts[0].text.toLowerCase().trim();
        
        return Object.keys(categories).includes(category) ? category : '';
    } catch (error) {
        console.error('Erro ao categorizar:', error);
        showToast('⚠️ Erro ao usar IA, categoria não foi atribuída', 'warning');
        return '';
    }
}

// Atualizar dashboard
function updateDashboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthExpenses = state.expenses.filter(e => e.date.startsWith(currentMonth));
    
    const totalMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const budget = state.settings.budget || 0;
    const percentage = budget > 0 ? (totalMonth / budget) * 100 : 0;
    
    // Atualizar cards
    document.getElementById('totalMonth').textContent = `R$ ${totalMonth.toFixed(2).replace('.', ',')}`;
    document.getElementById('budgetAmount').textContent = `R$ ${budget.toFixed(2).replace('.', ',')}`;
    
    // Atualizar alerta
    const alertCard = document.getElementById('cardAlert');
    const alertStatus = document.getElementById('alertStatus');
    
    alertCard.classList.remove('warning', 'danger');
    
    if (percentage >= 100) {
        alertStatus.textContent = '🔴 Orçamento Excedido!';
        alertCard.classList.add('danger');
    } else if (percentage >= state.settings.alertThreshold) {
        alertStatus.textContent = '🟡 Atenção!';
        alertCard.classList.add('warning');
    } else {
        alertStatus.textContent = '✅ Normal';
    }
    
    // Atualizar despesas recentes
    updateRecentExpenses();
}

// Atualizar lista de despesas recentes
function updateRecentExpenses() {
    const container = document.getElementById('recentExpenses');
    const sortedExpenses = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    if (sortedExpenses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Nenhuma despesa registrada</p>';
        return;
    }
    
    container.innerHTML = sortedExpenses.map(expense => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-category">${categories[expense.category]}</div>
                <div class="expense-description">${expense.description}</div>
                <div class="expense-date">${new Date(expense.date).toLocaleDateString('pt-BR')}</div>
            </div>
            <div style="text-align: right;">
                <div class="expense-amount">R$ ${expense.amount.toFixed(2).replace('.', ',')}</div>
                <button class="expense-delete" onclick="deleteExpense(${expense.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

// Deletar despesa
function deleteExpense(id) {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
        state.expenses = state.expenses.filter(e => e.id !== id);
        saveData();
        updateDashboard();
        showToast('✅ Despesa removida', 'success');
    }
}

// Deletar todas as despesas
function deleteAllExpenses() {
    if (confirm('⚠️ Tem certeza que deseja excluir TODO o histórico de despesas? Esta ação não pode ser desfeita!')) {
        state.expenses = [];
        saveData();
        updateDashboard();
        showToast('✅ Histórico removido', 'success');
    }
}

// Atualizar análise
function updateAnalytics() {
    const monthValue = document.getElementById('monthFilter').value;
    const [year, month] = monthValue.split('-');
    const monthExpenses = state.expenses.filter(e => e.date.startsWith(monthValue));
    
    // Agrupar por categoria
    const categoryTotals = {};
    monthExpenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });
    
    // Desenhar gráfico
    drawChart(categoryTotals);
    
    // Atualizar tabela
    updateCategoryTable(categoryTotals);
}

// Desenhar gráfico com Chart.js
function drawChart(categoryTotals) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = Object.keys(categoryTotals).map(cat => categories[cat] || cat);
    const data = Object.values(categoryTotals);
    
    // Destruir gráfico anterior se existir
    if (window.categoryChart instanceof Chart) {
        window.categoryChart.destroy();
    }
    
    window.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#6366f1',
                    '#f59e0b',
                    '#ef4444',
                    '#10b981',
                    '#06b6d4',
                    '#8b5cf6',
                    '#ec4899',
                    '#14b8a6',
                    '#f97316'
                ],
                borderColor: 'var(--bg-secondary)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--text)',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

// Atualizar tabela de categorias
function updateCategoryTable(categoryTotals) {
    const tbody = document.getElementById('categoryTableBody');
    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary);">Nenhuma despesa neste período</td></tr>';
        return;
    }
    
    tbody.innerHTML = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => {
            const percentage = ((amount / total) * 100).toFixed(1);
            return `
                <tr>
                    <td>${categories[category] || category}</td>
                    <td>R$ ${amount.toFixed(2).replace('.', ',')}</td>
                    <td>${percentage}%</td>
                </tr>
            `;
        }).join('');
}

// Gerar dicas com IA
async function generateTips() {
    if (!state.settings.geminiKey) {
        showToast('⚠️ Configure sua chave Gemini nas configurações', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthExpenses = state.expenses.filter(e => e.date.startsWith(currentMonth));
        
        if (monthExpenses.length === 0) {
            showToast('📊 Adicione despesas primeiro para receber dicas', 'info');
            showLoading(false);
            return;
        }
        
        // Calcular resumo das despesas
        const categoryTotals = {};
        monthExpenses.forEach(expense => {
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
        });
        
        const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const budget = state.settings.budget || 0;
        
        const prompt = `Você é um especialista em finanças pessoais. Analise este resumo de gastos do mês e forneça 3-4 dicas práticas e específicas para economizar dinheiro.
        
Resumo de gastos:
${Object.entries(categoryTotals).map(([cat, amount]) => `- ${categories[cat] || cat}: R$ ${amount.toFixed(2)}`).join('\n')}

Total: R$ ${total.toFixed(2)}
${budget > 0 ? `Orçamento: R$ ${budget.toFixed(2)} (${((total/budget)*100).toFixed(1)}% utilizado)` : ''}

Forneça as dicas de forma concisa e acionável.`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${state.settings.geminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });
        
        if (!response.ok) throw new Error('Erro na API');
        
        const data = await response.json();
        const tipsText = data.candidates[0].content.parts[0].text;
        
        // Parsear dicas
        const tips = tipsText.split('\n').filter(line => line.trim().length > 0);
        
        // Exibir dicas
        const tipsContainer = document.getElementById('tipsContainer');
        tipsContainer.innerHTML = tips.map((tip, index) => `
            <div class="tip-item">
                <div class="tip-title">💡 Dica ${index + 1}</div>
                <div class="tip-content">${tip.replace(/^[-•*]\s*/, '')}</div>
            </div>
        `).join('');
        
        showToast('✅ Dicas geradas com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao gerar dicas:', error);
        showToast('❌ Erro ao gerar dicas. Verifique sua chave de API', 'error');
    } finally {
        showLoading(false);
    }
}

// Modais e Configurações
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
    document.getElementById('geminiKey').value = state.settings.geminiKey;
    document.getElementById('budgetInput').value = state.settings.budget;
    document.getElementById('alertThreshold').value = state.settings.alertThreshold;
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

function saveSettings() {
    state.settings.geminiKey = document.getElementById('geminiKey').value;
    state.settings.budget = parseFloat(document.getElementById('budgetInput').value) || 0;
    state.settings.alertThreshold = parseInt(document.getElementById('alertThreshold').value) || 80;
    
    saveData();
    closeSettings();
    updateDashboard();
    showToast('✅ Configurações salvas!', 'success');
}

// Exportar dados
function exportData() {
    const dataStr = JSON.stringify({
        expenses: state.expenses,
        exportDate: new Date().toISOString(),
        settings: state.settings
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast('✅ Dados exportados!', 'success');
}

// Importar dados
function importData() {
    document.getElementById('fileInput').click();
}

document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (confirm('Tem certeza que deseja importar dados? Isso pode sobrescrever dados existentes.')) {
                state.expenses = data.expenses || [];
                state.settings = data.settings || state.settings;
                saveData();
                updateDashboard();
                showToast('✅ Dados importados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('❌ Erro ao importar arquivo', 'error');
        }
    };
    reader.readAsText(file);
});

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast active ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// Loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('active');
    } else {
        spinner.classList.remove('active');
    }
}

// Service Worker para PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {
            console.log('Service Worker não disponível');
        });
    }
}

// Fechar modal ao clicar fora
document.getElementById('settingsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
        closeSettings();
    }
});