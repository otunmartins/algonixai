-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('formulation_scientist', 'computational_chemist', 'regulatory_affairs', 'synthetic_chemist', 'academic_researcher');

-- CreateEnum
CREATE TYPE "IntentType" AS ENUM ('design', 'scientific_qa', 'dossier_generation', 'document_qa');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('draft', 'queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('literature_research', 'toxicity_validator', 'polymer_designer', 'physics_validator', 'cso', 'regulatory_affairs', 'synthetic_chemist', 'formulation_expert', 'market_analyst', 'quality_assurance', 'agent_coordinator');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "ModelStage" AS ENUM ('staging', 'production', 'archived');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "persona" "Persona" NOT NULL DEFAULT 'formulation_scientist',
    "org_id" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'draft',
    "persona" "Persona" NOT NULL,
    "prompt" TEXT NOT NULL,
    "intent_type" "IntentType" NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "draft_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "psmiles" TEXT NOT NULL,
    "toxicity_pass" BOOLEAN,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "rank" INTEGER,
    "benchmark_deltas" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "agent_name" "AgentName" NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "token_count" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "output" JSONB,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_traces" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "retrieved_chunks" JSONB NOT NULL DEFAULT '[]',
    "reranked_chunks" JSONB NOT NULL DEFAULT '[]',
    "hallucination_flags" JSONB NOT NULL DEFAULT '[]',
    "groundedness_score" DOUBLE PRECISION,
    "faithfulness_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_predictions" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "prediction" JSONB NOT NULL DEFAULT '{}',
    "uncertainty" DOUBLE PRECISION,
    "inference_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "experiment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "force_field" TEXT NOT NULL DEFAULT 'AMBER_ff14SB',
    "temperature_k" DOUBLE PRECISION NOT NULL DEFAULT 313.0,
    "timescale_ns" DOUBLE PRECISION,
    "rmsd_final" DOUBLE PRECISION,
    "converged" BOOLEAN,
    "storage_path" TEXT,
    "cost_usd" DOUBLE PRECISION,
    "gpu_provider" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_results" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "reference_name" TEXT NOT NULL,
    "delta_pct" DOUBLE PRECISION,
    "rank" INTEGER,

    CONSTRAINT "benchmark_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "literature_citations" (
    "id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "pubmed_id" TEXT,
    "title" TEXT,
    "year" INTEGER,
    "claim_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "literature_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "experiment_id" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "intent_history" JSONB NOT NULL DEFAULT '[]',
    "linked_experiment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "experiments_user_id_idx" ON "experiments"("user_id");

-- CreateIndex
CREATE INDEX "experiments_status_idx" ON "experiments"("status");

-- CreateIndex
CREATE INDEX "experiments_persona_idx" ON "experiments"("persona");

-- CreateIndex
CREATE INDEX "experiments_intent_type_idx" ON "experiments"("intent_type");

-- CreateIndex
CREATE INDEX "experiments_created_at_idx" ON "experiments"("created_at");

-- CreateIndex
CREATE INDEX "candidates_experiment_id_idx" ON "candidates"("experiment_id");

-- CreateIndex
CREATE INDEX "candidates_rank_idx" ON "candidates"("rank");

-- CreateIndex
CREATE INDEX "agent_runs_experiment_id_idx" ON "agent_runs"("experiment_id");

-- CreateIndex
CREATE INDEX "agent_runs_agent_name_idx" ON "agent_runs"("agent_name");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "rag_traces_experiment_id_idx" ON "rag_traces"("experiment_id");

-- CreateIndex
CREATE INDEX "model_predictions_candidate_id_idx" ON "model_predictions"("candidate_id");

-- CreateIndex
CREATE INDEX "model_predictions_model_name_idx" ON "model_predictions"("model_name");

-- CreateIndex
CREATE INDEX "simulation_runs_candidate_id_idx" ON "simulation_runs"("candidate_id");

-- CreateIndex
CREATE INDEX "simulation_runs_status_idx" ON "simulation_runs"("status");

-- CreateIndex
CREATE INDEX "benchmark_results_experiment_id_idx" ON "benchmark_results"("experiment_id");

-- CreateIndex
CREATE INDEX "benchmark_results_candidate_id_idx" ON "benchmark_results"("candidate_id");

-- CreateIndex
CREATE INDEX "literature_citations_chunk_id_idx" ON "literature_citations"("chunk_id");

-- CreateIndex
CREATE INDEX "literature_citations_pubmed_id_idx" ON "literature_citations"("pubmed_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_experiment_id_idx" ON "audit_log"("experiment_id");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_linked_experiment_id_idx" ON "chat_sessions"("linked_experiment_id");

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_traces" ADD CONSTRAINT "rag_traces_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_results" ADD CONSTRAINT "benchmark_results_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_results" ADD CONSTRAINT "benchmark_results_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_linked_experiment_id_fkey" FOREIGN KEY ("linked_experiment_id") REFERENCES "experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
