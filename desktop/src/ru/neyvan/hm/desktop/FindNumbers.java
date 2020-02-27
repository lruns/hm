package ru.neyvan.hm.desktop;

import ru.neyvan.hm.terms.AdditionNumerals;
import ru.neyvan.hm.terms.Divisibility;
import ru.neyvan.hm.terms.MultiplicationNumerals;
import ru.neyvan.hm.terms.Simple;
import ru.neyvan.hm.terms.SquareNumber;

public class FindNumbers {
    public static void main(String[] args){
        MultiplicationNumerals multi;
        System.out.println("Произведение цифр");
        for(int k=1; k<100; k++){
            multi = new MultiplicationNumerals(1, k);
            System.out.print(k+": ");
            for(int i=1; i<1000; i++){
                if(multi.checkCondition(i))System.out.print(i+", ");
            }
            System.out.println();
        }

        AdditionNumerals addd;
        System.out.println("Сумма цифр");
        for(int k=1; k<100; k++){
            addd = new AdditionNumerals(1, k);
            System.out.print(k+": ");
            for(int i=1; i<1000; i++){
                if(addd.checkCondition(i))System.out.print(i+", ");
            }
            System.out.println();
        }

        Simple simple = new Simple();
        System.out.println("Простое число");
        for(int i=1; i<1000; i++){
            if(simple.checkCondition(i))System.out.print(i+", ");
        }
        System.out.println();

        SquareNumber sq = new SquareNumber();
        System.out.println("Полный квадрат");
        for(int i=1; i<1000; i++){
            if(sq.checkCondition(i))System.out.print(i+", ");
        }
        System.out.println();

int n=0;
        for(int i=284; i>0; i-=8){
            Divisibility divisibility = new Divisibility(2, 6);
            System.out.print((divisibility.checkCondition(i)?"y":"n")+i+", ");

            n++;
        }

        System.out.print("\n\nn="+n);
    }
}
