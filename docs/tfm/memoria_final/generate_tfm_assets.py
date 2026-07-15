from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap


ROOT = Path(__file__).resolve().parents[3]
RESULTS = ROOT / "experiments/tests/campana2/resultado_export/results-summary.json"
OUT = Path(__file__).resolve().parent / "assets/generated"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#1F2937"
BLUE = "#005A8B"
TEAL = "#0F766E"
AMBER = "#B7791F"
RED = "#B42318"
GRID = "#D8E1E8"
LIGHT = "#EAF2F7"


def model_label(model_id: str) -> str:
    if "Qwen3.5" in model_id:
        return "Qwen3.5 4B"
    if "gemma-4" in model_id:
        return "Gemma 4 E4B"
    return "SmolLM3 3B"


MODE_LABELS = {
    "prompt_libre": "Contexto mínimo",
    "smart_sample": "Evidencia equilibrada",
    "recommended": "Evidencia completa",
}
MODEL_ORDER = ["Qwen3.5 4B", "Gemma 4 E4B", "SmolLM3 3B"]
MODE_ORDER = ["Contexto mínimo", "Evidencia equilibrada", "Evidencia completa"]


def load_data():
    raw = json.loads(RESULTS.read_text(encoding="utf-8"))
    scores = {}
    for item in raw["scores"]:
        scores[(model_label(item["modelId"]), MODE_LABELS[item["inputMode"]])] = item
    cells = {}
    for item in raw["matrix"]["cells"]:
        cells[(model_label(item["modelId"]), MODE_LABELS[item["inputMode"]])] = item
    return raw, scores, cells


def style_ax(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(GRID)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=INK, labelsize=9)


def save(fig, name):
    fig.savefig(OUT / name, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def balanced_heatmap(scores):
    values = np.array(
        [[scores[(m, mode)]["balanced"] for mode in MODE_ORDER] for m in MODEL_ORDER]
    )
    cmap = LinearSegmentedColormap.from_list("aura", ["#F6D9D5", "#F7E7C6", "#D6ECEA"])
    fig, ax = plt.subplots(figsize=(8.8, 4.4))
    im = ax.imshow(values, cmap=cmap, vmin=0, vmax=100)
    ax.set_xticks(range(3), ["Contexto\nmínimo", "Evidencia\nequilibrada", "Evidencia\ncompleta"])
    ax.set_yticks(range(3), MODEL_ORDER)
    ax.tick_params(length=0, labelsize=10)
    for i in range(3):
        for j in range(3):
            v = values[i, j]
            ax.text(j, i - 0.05, f"{v:.1f}", ha="center", va="center", color=INK,
                    fontsize=15, fontweight="bold")
            cell = scores[(MODEL_ORDER[i], MODE_ORDER[j])]
            ax.text(j, i + 0.23, f"Fiabilidad {cell['reliability']:.0f}%", ha="center",
                    va="center", color="#5B6573", fontsize=8)
    ax.set_title("Índice equilibrado por modelo y método de entrada", loc="left",
                 fontsize=14, fontweight="bold", color=INK, pad=18)
    ax.set_xlabel("Método de entrada", color=INK, labelpad=12)
    ax.set_ylabel("Modelo", color=INK, labelpad=12)
    cbar = fig.colorbar(im, ax=ax, fraction=0.035, pad=0.04)
    cbar.set_label("Puntuación (0–100)", color=INK)
    cbar.outline.set_edgecolor(GRID)
    save(fig, "campaign2-balanced-heatmap.png")


def reliability_latency(scores, cells):
    fig, ax = plt.subplots(figsize=(8.8, 4.8))
    markers = {"Qwen3.5 4B": "o", "Gemma 4 E4B": "s", "SmolLM3 3B": "^"}
    colors = dict(zip(MODE_ORDER, [BLUE, TEAL, AMBER]))
    for model in MODEL_ORDER:
        for mode in MODE_ORDER:
            score = scores[(model, mode)]
            cell = cells[(model, mode)]
            latency = cell["totalLatencyMs"]["median"]
            if latency is None:
                continue
            ax.scatter(latency / 1000, score["reliability"], s=115,
                       marker=markers[model], color=colors[mode], edgecolor="white", linewidth=1.2)
            if mode == "Contexto mínimo":
                offsets = {"Qwen3.5 4B": (-35, 10), "Gemma 4 E4B": (-8, -28), "SmolLM3 3B": (7, 8)}
                ax.annotate(model, (latency / 1000, score["reliability"]),
                            xytext=offsets[model], textcoords="offset points", fontsize=8, color=INK)
    style_ax(ax)
    ax.grid(True, color=GRID, linewidth=0.7, alpha=0.7)
    ax.set_xlim(left=20)
    ax.set_ylim(-4, 106)
    ax.set_xlabel("Latencia mediana (segundos)")
    ax.set_ylabel("Fiabilidad (% de corridas válidas)")
    ax.set_title("Compromiso entre velocidad y fiabilidad", loc="left",
                 fontsize=14, fontweight="bold", color=INK, pad=18)
    from matplotlib.lines import Line2D
    legend = [Line2D([0], [0], marker="o", color="w", label=mode,
                     markerfacecolor=colors[mode], markersize=8) for mode in MODE_ORDER]
    ax.legend(handles=legend, frameon=False, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.14))
    save(fig, "campaign2-reliability-latency.png")


def completion_chart(cells):
    labels = [f"{m}\n{mode}" for m in MODEL_ORDER for mode in MODE_ORDER]
    valid = [cells[(m, mode)]["completedRuns"] for m in MODEL_ORDER for mode in MODE_ORDER]
    failed = [cells[(m, mode)]["failedRuns"] for m in MODEL_ORDER for mode in MODE_ORDER]
    x = np.arange(len(labels))
    fig, ax = plt.subplots(figsize=(10.4, 4.8))
    ax.bar(x, valid, color=TEAL, label="Válidas")
    ax.bar(x, failed, bottom=valid, color="#D97766", label="Fallidas")
    for i, (v, f) in enumerate(zip(valid, failed)):
        ax.text(i, v + f + 0.07, f"{v}/{v+f}", ha="center", va="bottom", fontsize=8, color=INK)
    style_ax(ax)
    ax.set_xticks(x, labels, rotation=35, ha="right", fontsize=7.5)
    ax.set_ylim(0, 3.65)
    ax.set_yticks([0, 1, 2, 3])
    ax.set_ylabel("Corridas")
    ax.set_title("Resultado de las 27 unidades experimentales", loc="left",
                 fontsize=14, fontweight="bold", color=INK, pad=18)
    ax.legend(frameon=False, ncol=2, loc="upper right")
    save(fig, "campaign2-completion.png")


def dimensions_chart(scores):
    selected = [
        ("Qwen3.5 4B", "Contexto mínimo"),
        ("Gemma 4 E4B", "Contexto mínimo"),
        ("SmolLM3 3B", "Contexto mínimo"),
    ]
    dims = ["reliability", "evidenceSupport", "hallucinationSafety", "efficiency"]
    dim_labels = ["Fiabilidad", "Evidencia", "Claims soportados", "Eficiencia"]
    x = np.arange(len(dims))
    width = 0.24
    fig, ax = plt.subplots(figsize=(8.8, 4.8))
    palette = [BLUE, TEAL, AMBER]
    for idx, pair in enumerate(selected):
        item = scores[pair]
        vals = [item[d] for d in dims]
        ax.bar(x + (idx - 1) * width, vals, width, color=palette[idx], label=pair[0])
    style_ax(ax)
    ax.set_xticks(x, dim_labels)
    ax.set_ylim(0, 110)
    ax.set_ylabel("Puntuación (0–100)")
    ax.grid(axis="y", color=GRID, linewidth=0.7, alpha=0.7)
    ax.set_title("Dimensiones del método Contexto mínimo", loc="left",
                 fontsize=14, fontweight="bold", color=INK, pad=18)
    ax.legend(frameon=False, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.14))
    save(fig, "campaign2-dimensions-context-minimum.png")


def campaign_evolution():
    labels = ["Campaña 1\nprotocolo 2.5.0", "Campaña 2\nprotocolo 2.6.0"]
    completed = [19, 20]
    failed = [8, 7]
    x = np.arange(2)
    fig, ax = plt.subplots(figsize=(7.6, 4.4))
    ax.bar(x, completed, color=TEAL, width=0.55, label="Diagnósticos válidos")
    ax.bar(x, failed, bottom=completed, color="#D97766", width=0.55, label="Fallos conservados")
    for i in range(2):
        ax.text(i, completed[i] / 2, str(completed[i]), ha="center", va="center",
                color="white", fontsize=14, fontweight="bold")
        ax.text(i, completed[i] + failed[i] / 2, str(failed[i]), ha="center", va="center",
                color="white", fontsize=12, fontweight="bold")
    style_ax(ax)
    ax.set_xticks(x, labels)
    ax.set_ylim(0, 30)
    ax.set_ylabel("27 corridas por campaña")
    ax.set_title("Del piloto de calibración al protocolo definitivo", loc="left",
                 fontsize=14, fontweight="bold", color=INK, pad=18)
    ax.legend(frameon=False, ncol=2, loc="upper center", bbox_to_anchor=(0.5, -0.16))
    save(fig, "campaign-evolution.png")


def architecture_diagram():
    fig, ax = plt.subplots(figsize=(10.2, 4.2))
    ax.axis("off")
    boxes = [
        (0.02, 0.58, 0.15, 0.22, "CSV local", "El archivo permanece\nen el navegador"),
        (0.22, 0.58, 0.15, 0.22, "Motor determinista", "Reglas, tipos,\nestadística"),
        (0.42, 0.58, 0.15, 0.22, "Paquete de evidencia", "Tres métodos de\nentrada controlados"),
        (0.62, 0.58, 0.15, 0.22, "Diagnóstico LLM", "JSON V2 validado\ny recibido"),
        (0.82, 0.58, 0.15, 0.22, "Informe", "Hallazgos, límites\ny trazabilidad"),
        (0.52, 0.12, 0.15, 0.22, "Plan determinista", "Acciones cerradas\npor regla"),
        (0.70, 0.12, 0.12, 0.22, "HITL", "Aprobar o\nrechazar"),
        (0.85, 0.12, 0.12, 0.22, "Aplicar y verificar", "Runner, recibo,\nreauditoría"),
    ]
    for x, y, w, h, title, sub in boxes:
        ax.add_patch(plt.Rectangle((x, y), w, h, facecolor=LIGHT, edgecolor=BLUE,
                                   linewidth=1.2, transform=ax.transAxes))
        ax.text(x + w/2, y + h*0.66, title, ha="center", va="center",
                fontsize=9, color=INK, fontweight="bold", transform=ax.transAxes)
        ax.text(x + w/2, y + h*0.30, sub, ha="center", va="center",
                fontsize=7.5, color="#5B6573", transform=ax.transAxes)
    def arrow(a, b):
        ax.annotate("", xy=b, xytext=a, xycoords=ax.transAxes,
                    arrowprops=dict(arrowstyle="->", color=INK, lw=1.3))
    for a, b in [((0.17, .69), (.22, .69)), ((.37,.69),(.42,.69)), ((.57,.69),(.62,.69)), ((.77,.69),(.82,.69))]:
        arrow(a,b)
    arrow((.695,.58),(.595,.34)); arrow((.67,.23),(.70,.23)); arrow((.82,.23),(.85,.23))
    ax.text(.02,.92,"Arquitectura funcional y frontera de autoridad", fontsize=14,
            fontweight="bold", color=INK, transform=ax.transAxes)
    ax.text(.02,.02,"El Laboratorio reutiliza el mismo diagnóstico; la rama de remediación permanece en el pipeline normal.",
            fontsize=8.5, color="#5B6573", transform=ax.transAxes)
    save(fig, "aura-functional-architecture.png")


if __name__ == "__main__":
    raw, scores, cells = load_data()
    balanced_heatmap(scores)
    reliability_latency(scores, cells)
    completion_chart(cells)
    dimensions_chart(scores)
    campaign_evolution()
    architecture_diagram()
    print(f"Assets written to {OUT}")
