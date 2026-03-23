/**
 * 需求计算器
 */

import { DNA, Phenotype, DynamicNeeds } from '../dna/DNA';

export interface IndividualState {
    storedFood: number;
    storedWater: number;
    health: number;
    lastMealTime: number;
    lastDrinkTime: number;
    lastRestTime: number;  // 0 = 精力充沛, 越大越累
    lastSocialTime: number;
    position: { x: number; y: number };
    age: number;
    sex: 'male' | 'female';
    aloneTime: number;
}

export interface WorldState {
    time: number;
    threats: Threat[];
    nearbyFood: Resource[];
    nearbyWater: Resource[];
    nearbyIndividuals: number;
    temperature: number;
    isNight: boolean;
}

export interface Threat {
    type: 'predator' | 'hostile' | 'disaster';
    distance: number;
    dangerLevel: number;
}

export interface Resource {
    type: string;
    position: { x: number; y: number };
    quantity: number;
}

export class NeedsCalculator {
    calculate(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): DynamicNeeds {
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
    private calculateHunger(individual: IndividualState, dna: Phenotype): number {
        let hunger = Math.min(1, individual.lastMealTime / 100);
        hunger -= individual.storedFood / 50;
        hunger *= dna.metabolism;
        return Math.max(0, Math.min(1, hunger));
    }
    
    // 口渴：lastDrinkTime越大越渴
    private calculateThirst(individual: IndividualState, dna: Phenotype): number {
        let thirst = Math.min(1, individual.lastDrinkTime / 60);
        thirst -= individual.storedWater / 30;
        thirst *= dna.metabolism;
        return Math.max(0, Math.min(1, thirst));
    }
    
    // 精力：lastRestTime越大越累
    private calculateEnergy(individual: IndividualState, worldState: WorldState, dna: Phenotype): number {
        let energy = Math.min(1, individual.lastRestTime / 100);
        if (worldState.isNight) energy *= 1.5;
        return Math.max(0, Math.min(1, energy));
    }
    
    private calculateSafety(individual: IndividualState, worldState: WorldState, dna: Phenotype): number {
        let safety = 0;
        for (const threat of worldState.threats) {
            if (threat.distance < 50) safety += 0.5;
            else if (threat.distance < 100) safety += 0.3;
            else if (threat.distance < 200) safety += 0.1;
        }
        if (worldState.isNight) safety += 0.2;
        return Math.min(1, safety);
    }
    
    private calculateSocial(individual: IndividualState, worldState: WorldState, dna: Phenotype): number {
        if (worldState.nearbyIndividuals > 0) return 0;
        return Math.min(1, individual.aloneTime / 300);
    }
    
    private calculateCuriosity(individual: IndividualState, worldState: WorldState, dna: Phenotype): number {
        return dna.curiosity * 0.3;
    }
    
    private calculateReproduction(individual: IndividualState, worldState: WorldState, dna: Phenotype): number {
        if (individual.age < 60 || individual.age > 600) return 0;
        return dna.fertility * 0.2;
    }
    
    getDominantNeed(needs: DynamicNeeds): string {
        const entries = Object.entries(needs);
        let max = { name: 'hunger', value: 0 };
        for (const [name, value] of entries) {
            if (value > max.value) max = { name, value };
        }
        return max.name;
    }
}
