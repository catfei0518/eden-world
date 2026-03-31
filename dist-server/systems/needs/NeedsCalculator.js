"use strict";
/**
 * 需求计算器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeedsCalculator = void 0;
class NeedsCalculator {
    calculate(individual, worldState, dna) {
        return {
            hunger: this.calculateHunger(individual, dna),
            thirst: this.calculateThirst(individual, dna),
            energy: this.calculateEnergy(individual, worldState, dna),
            safety: this.calculateSafety(individual, worldState, dna),
            social: this.calculateSocial(individual, worldState, dna),
            curiosity: this.calculateCuriosity(individual, worldState, dna),
            reproduction: this.calculateReproduction(individual, worldState, dna)
        };
    }
    // 饥饿：lastMealTime越大越饿
    calculateHunger(individual, dna) {
        let hunger = Math.min(1, individual.lastMealTime / 100);
        hunger -= individual.storedFood / 50;
        hunger *= dna.metabolism;
        return Math.max(0, Math.min(1, hunger));
    }
    // 口渴：lastDrinkTime越大越渴
    calculateThirst(individual, dna) {
        let thirst = Math.min(1, individual.lastDrinkTime / 60);
        thirst -= individual.storedWater / 30;
        thirst *= dna.metabolism;
        return Math.max(0, Math.min(1, thirst));
    }
    // 精力：lastRestTime越大越累
    calculateEnergy(individual, worldState, dna) {
        let energy = Math.min(1, individual.lastRestTime / 100);
        if (worldState.isNight)
            energy *= 1.5;
        return Math.max(0, Math.min(1, energy));
    }
    calculateSafety(individual, worldState, dna) {
        let safety = 0;
        for (const threat of worldState.threats) {
            if (threat.distance < 50)
                safety += 0.5;
            else if (threat.distance < 100)
                safety += 0.3;
            else if (threat.distance < 200)
                safety += 0.1;
        }
        if (worldState.isNight)
            safety += 0.2;
        return Math.min(1, safety);
    }
    calculateSocial(individual, worldState, dna) {
        if (worldState.nearbyIndividuals > 0)
            return 0;
        return Math.min(1, individual.aloneTime / 300);
    }
    calculateCuriosity(individual, worldState, dna) {
        return dna.curiosity * 0.3;
    }
    calculateReproduction(individual, worldState, dna) {
        if (individual.age < 60 || individual.age > 600)
            return 0;
        return dna.fertility * 0.2;
    }
    getDominantNeed(needs) {
        const entries = Object.entries(needs);
        let max = { name: 'hunger', value: 0 };
        for (const [name, value] of entries) {
            if (value > max.value)
                max = { name, value };
        }
        return max.name;
    }
}
exports.NeedsCalculator = NeedsCalculator;
