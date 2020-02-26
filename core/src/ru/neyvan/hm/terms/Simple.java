package ru.neyvan.hm.terms;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class Simple extends Term {
    public Simple(){super();}
    public Simple(int ID) {
        super(ID);
    }
    private double s, i;
    @Override
    public boolean checkCondition(int numberToCheck) {
        if (numberToCheck < 2)
            return false;
        s = Math.sqrt(numberToCheck);
        for (i = 2; i <= s; i++) {
            if (numberToCheck % i == 0)
                return false;
        }
        return true;
    }
    @Override
    public String printDescription() {
        return HM.game.bundle.get("simple");
    }
}
