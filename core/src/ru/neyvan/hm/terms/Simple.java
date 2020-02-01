package ru.neyvan.hm.terms;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class Simple extends Term {
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
}
