package ru.neyvan.hm.terms;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class GeometricProgression extends Term {
    private int first, commonRatio;
    public GeometricProgression(){super();}
    public GeometricProgression(int ID, int first, int commonRatio) {
        super(ID);
        this.first = first;
        this.commonRatio = commonRatio;
    }
    private int b;
    @Override
    public boolean checkCondition(int numberToCheck) {
        b = first; if(b==numberToCheck) return true;
        while (b<numberToCheck){
            b = b*commonRatio;
            if(b==numberToCheck) return true;
        }
        return false;
    }

    public int getFirst() {
        return first;
    }

    public int getCommonRatio() {
        return commonRatio;
    }

    @Override
    public String printDescription() {
        return HM.game.bundle.format("geometricProgression", first, commonRatio);
    }
}
